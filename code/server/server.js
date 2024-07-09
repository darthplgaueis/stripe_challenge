/* eslint-disable no-console */
const express = require("express");

const app = express();
const { resolve } = require("path");
// Replace if using a different env file or config
require("dotenv").config({ path: "./.env" });
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const allitems = {};
const fs = require("fs");

app.use(express.static(process.env.STATIC_DIR));

app.use(
  express.json({
    // Should use middleware or a function to compute it only when
    // hitting the Stripe webhook endpoint.
    verify: (req, res, buf) => {
      if (req.originalUrl.startsWith("/webhook")) {
        req.rawBody = buf.toString();
      }
    },
  })
);
app.use(cors({ origin: true }));

// const asyncMiddleware = fn => (req, res, next) => {
//   Promise.resolve(fn(req, res, next)).catch(next);
// };

app.post("/webhook", async (req, res) => {
  // TODO: Integrate Stripe
});

// Routes
app.get("/", (req, res) => {
  try {
    const path = resolve(`${process.env.STATIC_DIR}/index.html`);
    if (!fs.existsSync(path)) throw Error();
    res.sendFile(path);
  } catch (error) {
    const path = resolve("./public/static-file-error.html");
    res.sendFile(path);
  }
});

// Fetch the Stripe publishable key
//
// Example call:
// curl -X GET http://localhost:4242/config \
//
// Returns: a JSON response of the pubblishable key
//   {
//        key: <STRIPE_PUBLISHABLE_KEY>
//   }
app.get("/config", (req, res) => {
  // TODO: Integrate Stripe
  res.send({
    key: process.env.STRIPE_PUBLISHABLE_KEY,
  });
});

// Milestone 1: Signing up
// Shows the lesson sign up page.
app.get("/lessons", (req, res) => {
  try {
    const path = resolve(`${process.env.STATIC_DIR}/lessons.html`);
    if (!fs.existsSync(path)) throw Error();
    res.sendFile(path);
  } catch (error) {
    const path = resolve("./public/static-file-error.html");
    res.sendFile(path);
  }
});

app.post("/lessons", async (req, res) => {
  const { name, email, lessonDateTime } = req.body;

  try {
    let customer = await stripe.customers.list({
      email,
      limit: 1,
    });

    if (customer.data.length === 0) {
      customer = await stripe.customers.create({
        name,
        email,
        metadata: {
          first_lesson: lessonDateTime,
        },
      });
    } else {
      customer = customer.data[0];
      // Update the existing customer with the new name
      await stripe.customers.update(customer.id, { name });
      return res.status(201).send({
        error: "A customer with this email address already exists.",
        customerId: customer.id,
      });
    }

    // Create a basic SetupIntent
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      usage: "off_session",
    });

    res.status(200).send({
      clientSecret: setupIntent.client_secret,
      customerId: customer.id,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      error: error.message,
    });
  }
});
app.get("/get-payment-method-details/:paymentMethodId", async (req, res) => {
  try {
    const paymentMethodId = req.params.paymentMethodId;
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    res.json({
      last4: paymentMethod.card.last4,
      brand: paymentMethod.card.brand,
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Failed to retrieve payment method details" });
  }
});

app.post("/create-setup-intent", async (req, res) => {
  const { customerId } = req.body;

  if (!customerId) {
    return res.status(400).json({ error: "Customer ID is required" });
  }

  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
    });

    res.json({ clientSecret: setupIntent.client_secret });
  } catch (error) {
    console.error("Error creating Setup Intent:", error);
    res.status(500).json({ error: "Failed to create Setup Intent" });
  }
});

app.post("/schedule-lesson", async (req, res) => {
  const { customer_id, amount, description } = req.body;
  try {
    // Fetch the customer's payment methods
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer_id,
      type: "card",
    });

    if (paymentMethods.data.length === 0) {
      return res.status(400).json({
        error: {
          code: "no_payment_method",
          message: `No payment methods found for ${customer_id}`,
        },
      });
    }

    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: "usd",
      customer: customer_id,
      payment_method: paymentMethods.data[0].id,
      confirm: true,
      off_session: true,
      capture_method: "manual", // Manually capture the payment later
      description: description,
    });

    return res.status(200).json({ payment: paymentIntent });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    return res.status(400).json({
      error: {
        code: error.code || "unknown_error",
        message: error.message || "An unknown error occurred",
      },
      payment_intent_id: error.payment_intent
        ? error.payment_intent.id
        : undefined,
    });
  }
});

app.post("/complete-lesson-payment", async (req, res) => {
  const { payment_intent_id, amount } = req.body;
  // console.log("complete lesson payment endpoint hit!");
  try {
    const paymentIntent = await stripe.paymentIntents.capture(
      payment_intent_id
    );

    // Capture the PaymentIntent
    // console(paymentIntent);

    // Return the successful payment intent
    res.json({ payment: paymentIntent });
  } catch (error) {
    // Handle errors
    console.error("Error  payment intent:", error);
    return res.status(400).json({
      error: {
        code: error.code || "resource_missing",
        message: `No such payment_intent: '${payment_intent_id}'`,
      },
    });
  }
});

app.post("/refund-lesson", async (req, res) => {
  const { payment_intent_id, amount } = req.body;

  try {
    // Retrieve the PaymentIntent to check its status
    const paymentIntent = await stripe.paymentIntents.retrieve(
      payment_intent_id
    );

    let refund;

    if (paymentIntent.status === "succeeded") {
      // If the payment has been captured, create a refund
      refund = await stripe.refunds.create({
        payment_intent: payment_intent_id,
        amount: amount, // If amount is not provided, it will refund the full amount
        reason: "requested_by_customer",
      });

      res.json({ refund: refund.id });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(400).json({
      error: {
        code: "resource_missing",
        message: `No such payment_intent: '${payment_intent_id}'`,
      },
    });
  }
});

// Milestone 3: Managing account info
// Displays the account update page for a given customer
app.get("/account-update/:customer_id", async (req, res) => {
  try {
    const path = resolve(`${process.env.STATIC_DIR}/account-update.html`);
    if (!fs.existsSync(path)) throw Error();
    res.sendFile(path);
  } catch (error) {
    const path = resolve("./public/static-file-error.html");
    res.sendFile(path);
  }
});

app.get("/payment-method/:customer_id", async (req, res) => {
  const customerId = req.params.customer_id;

  try {
    const paymentMethods = await stripe.customers.listPaymentMethods(
      customerId,
      {
        limit: 1,
      }
    );

    if (paymentMethods.data.length === 0) {
      console.log("No payment methods found for this customer.");
      return res
        .status(404)
        .json({ message: "No payment methods found for this customer." });
    }

    const paymentMethod = paymentMethods.data[0];

    res.status(200).send(paymentMethod);
  } catch (error) {
    console.error("Failed to retrieve payment methods:", error);
    res.status(500).json({
      error: "Failed to retrieve payment methods",
      details: error.message,
    });
  }
});

// app.post("/update-payment-details/:customer_id", async (req, res) => {
//   const customerId = req.params.customer_id;
//   const { paymentMethodId } = req.body;

//   if (!paymentMethodId) {
//     return res.status(400).json({ error: "Payment method ID is required" });
//   }

//   try {
//     // Attach the new payment method to the customer
//     await stripe.paymentMethods.attach(paymentMethodId, {
//       customer: customerId,
//     });

//     // Set it as the default payment method
//     await stripe.customers.update(customerId, {
//       invoice_settings: {
//         default_payment_method: paymentMethodId,
//       },
//     });

//     // Retrieve the updated payment method to send back to the client
//     const updatedPaymentMethod = await stripe.paymentMethods.retrieve(
//       paymentMethodId
//     );

//     res.json({
//       success: true,
//       paymentMethod: {
//         id: updatedPaymentMethod.id,
//         type: updatedPaymentMethod.type,
//         billingDetails: updatedPaymentMethod.billing_details,
//         card: {
//           brand: updatedPaymentMethod.card.brand,
//           expMonth: updatedPaymentMethod.card.exp_month,
//           expYear: updatedPaymentMethod.card.exp_year,
//           last4: updatedPaymentMethod.card.last4,
//         },
//       },
//     });
//   } catch (error) {
//     console.error("Error updating payment details:", error);
//     res.status(500).json({
//       error: "Failed to update payment details",
//       details: error.message,
//     });
//   }
// });

app.post("/update-payment-details/:customer_id", async (req, res) => {
  const customerId = req.params.customer_id;
  const { paymentMethodId } = req.body;

  if (!paymentMethodId) {
    return res.status(400).json({ error: "Payment method ID is required" });
  }

  try {
    // Retrieve the customer to get their current payment methods
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ["invoice_settings.default_payment_method"],
    });

    // If there's an existing default payment method, detach it
    if (customer.invoice_settings.default_payment_method) {
      await stripe.paymentMethods.detach(
        customer.invoice_settings.default_payment_method.id
      );
    }

    // Attach the new payment method to the customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // Set it as the default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Retrieve the updated payment method to send back to the client
    const updatedPaymentMethod = await stripe.paymentMethods.retrieve(
      paymentMethodId
    );

    res.json({
      success: true,
      paymentMethod: {
        id: updatedPaymentMethod.id,
        type: updatedPaymentMethod.type,
        billingDetails: updatedPaymentMethod.billing_details,
        card: {
          brand: updatedPaymentMethod.card.brand,
          expMonth: updatedPaymentMethod.card.exp_month,
          expYear: updatedPaymentMethod.card.exp_year,
          last4: updatedPaymentMethod.card.last4,
        },
      },
    });
  } catch (error) {
    console.error("Error updating payment details:", error);
    res.status(500).json({
      error: "Failed to update payment details",
      details: error.message,
    });
  }
});

app.post("/account-update/:customer_id", async (req, res) => {
  try {
    const customerId = req.params.customer_id;
    const { name, email } = req.body;

    // Retrieve the customer
    let customer = await stripe.customers.retrieve(customerId, {
      expand: ['invoice_settings.default_payment_method']
    });

    let emailAlreadyExists = false;

    // Check if email is provided and different from current
    if (email && email !== customer.email) {
      // Search for customers with the new email
      const existingCustomers = await stripe.customers.list({
        email: email,
        limit: 1
      });
      console.log("existing customers: ", existingCustomers);

      // If a customer with this email already exists (and it's not the current customer)
      if (existingCustomers.data.length > 0 && existingCustomers.data[0].id !== customerId) {
        emailAlreadyExists = true;
      }
    }
    console.log(emailAlreadyExists);

    if(emailAlreadyExists){
      return res.status(201).send({message : "Customer email already exists!"});
    }
    let paymentMethodId = customer.invoice_settings.default_payment_method?.id;

    // If no default payment method, try to get the first available payment method
    if (!paymentMethodId) {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card'
      });

      if (paymentMethods.data.length > 0) {
        paymentMethodId = paymentMethods.data[0].id;
      } else {
        return res.status(404).json({ error: "No payment methods found for this customer" });
      }
    }

    // Prepare the update object
    const updateData = {};
    if (name !== undefined && name !== "") {
      updateData.name = name;
    }
    if (email !== undefined && email !== "" && !emailAlreadyExists) {
      updateData.email = email;
    }

    // Only update if there are changes
    if (Object.keys(updateData).length > 0) {
      // Update the customer first
      if (updateData.email || updateData.name) {
        await stripe.customers.update(customerId, {
          email: updateData.email,
          name: updateData.name
        });
      }

      // Update the payment method with new billing details
      const updatedPaymentMethod = await stripe.paymentMethods.update(paymentMethodId, {
        billing_details: updateData,
      });

      res.status(200).json({
        success: true,
        emailAlreadyExists: emailAlreadyExists,
        paymentMethod: {
          id: updatedPaymentMethod.id,
          type: updatedPaymentMethod.type,
          billingDetails: updatedPaymentMethod.billing_details,
          card: updatedPaymentMethod.card ? {
            brand: updatedPaymentMethod.card.brand,
            expMonth: updatedPaymentMethod.card.exp_month,
            expYear: updatedPaymentMethod.card.exp_year,
            last4: updatedPaymentMethod.card.last4,
          } : null,
        },
      });
    } else {
      res.status(200).json({
        success: true,
        emailAlreadyExists: emailAlreadyExists,
        message: "No updates were necessary",
      });
    }
  } catch (error) {
    console.error("Error updating payment method details:", error);
    res.status(500).json({
      error: "An error occurred while updating the payment method details.",
      details: error.message
    });
  }
});
app.post("/delete-account/:customer_id", async (req, res) => {
  try {
    const customerId = req.params.customer_id;

    // First, check for any uncaptured PaymentIntents
    const paymentIntents = await stripe.paymentIntents.list({
      customer: customerId,
      limit: 100, // Adjust this limit as needed
    });

    const uncapturedPaymentIntents = paymentIntents.data.filter(
      (pi) => pi.status === 'requires_capture'
    );

    if (uncapturedPaymentIntents.length > 0) {
      // If there are uncaptured PaymentIntents, return their IDs
      return res.status(200).json({
        uncaptured_payments: uncapturedPaymentIntents.map(pi => pi.id)
      });
    }

    // If no uncaptured PaymentIntents, proceed with deletion
    const deletedCustomer = await stripe.customers.del(customerId);

    if (deletedCustomer.deleted) {
      return res.status(200).json({
        deleted: true
      });
    } else {
      // This case should rarely occur, but it's good to handle it
      throw new Error('Customer not deleted for unknown reason');
    }

  } catch (e) {
    console.error('Error deleting customer:', e);

    // Check if it's a Stripe error
    if (e.type === 'StripeError') {
      return res.status(400).json({
        error: {
          code: e.code,
          message: e.message
        }
      });
    }

    // For other types of errors
    return res.status(500).json({
      error: {
        code: 'internal_server_error',
        message: 'An unexpected error occurred'
      }
    });
  }
});

// Milestone 4: '/calculate-lesson-total'
// Returns the total amounts for payments for lessons, ignoring payments
// for videos and concert tickets, ranging over the last 36 hours.
//
// Example call: curl -X GET http://localhost:4242/calculate-lesson-total
//
// Returns a JSON response of the format:
// {
//      payment_total: Total before fees and refunds (including disputes), and excluding payments
//         that haven't yet been captured.
//      fee_total: Total amount in fees that the store has paid to Stripe
//      net_total: Total amount the store has collected from payments, minus their fees.
// }
//
app.get("/calculate-lesson-total", async (req, res) => {
  // TODO: Integrate Stripe
});

// Milestone 4: '/find-customers-with-failed-payments'
// Returns any customer who meets the following conditions:
// The last attempt to make a payment for that customer failed.
// The payment method associated with that customer is the same payment method used
// for the failed payment, in other words, the customer has not yet supplied a new payment method.
//
// Example request: curl -X GET http://localhost:4242/find-customers-with-failed-payments
//
// Returns a JSON response with information about each customer identified and
// their associated last payment
// attempt and, info about the payment method on file.
// [
//   {
//     customer: {
//       id: customer.id,
//       email: customer.email,
//       name: customer.name,
//     },
//     payment_intent: {
//       created: created timestamp for the payment intent
//       description: description from the payment intent
//       status: the status of the payment intent
//       error: the reason that the payment attempt was declined
//     },
//     payment_method: {
//       last4: last four of the card stored on the customer
//       brand: brand of the card stored on the customer
//     }
//   },
//   {},
//   {},
// ]
app.get("/find-customers-with-failed-payments", async (req, res) => {
  // TODO: Integrate Stripe
});

function errorHandler(err, req, res, next) {
  res.status(500).send({ error: { message: err.message } });
}

app.use(errorHandler);

app.listen(4242, () =>
  console.log(`Node server listening on port http://localhost:${4242}`)
);
