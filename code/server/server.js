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

// TODO: Integrate Stripe

// Milestone 2: '/schedule-lesson'
// Authorize a payment for a lesson
//
// Parameters:
// customer_id: id of the customer
// amount: amount of the lesson in cents
// description: a description of this lesson
//
// Example call:
// curl -X POST http://localhost:4242/schedule-lesson \
//  -d customer_id=cus_GlY8vzEaWTFmps \
//  -d amount=4500 \
//  -d description='Lesson on Feb 25th'
//
// Returns: a JSON response of one of the following forms:
// For a successful payment, return the Payment Intent:
//   {
//        payment: <payment_intent>
//    }
//
// For errors:
//  {
//    error:
//       code: the code returned from the Stripe error if there was one
//       message: the message returned from the Stripe error. if no payment method was
//         found for that customer return an msg 'no payment methods found for <customer_id>'
//    payment_intent_id: if a payment intent was created but not successfully authorized
// }
// ####### My implementation ############
// app.post("/schedule-lesson", async (req, res) => {
// TODO: Integrate Stripe
//   const { customerId, amount, description } = req.body;

//   try {
//     const paymentIntent = await stripe.paymentIntents.create({
//       amount,
//       customer: customerId,
//       currency: "usd",
//       automatic_payment_methods: {
//         enabled: true,
//       },
//     });
//     res.send(200).json({payment : paymentIntent});
//   } catch (error) {
//     res
//     .status(500)
//     .json( error.message );
//   }
// });

// app.post("/schedule-lesson", async (req, res) => {
//   const { customer_id, amount, description } = await req.body;

//   console.log(customer_id, amount, description);
//   try {
//     // Fetch the customer to check for payment methods
//     const customer = await stripe.customers.retrieve(customer_id);
//     console.log(customer);
//     // if (!customer.invoice_settings.default_payment_method) {
//     //   return res.status(400).json({
//     //     error: {
//     //       code: "no_payment_method",
//     //       message: `No payment methods found for ${customer_id}`,
//     //     },
//     //   });
//     // }

//     // Create a PaymentIntent
//     const paymentIntent = await stripe.paymentIntents.create({
//       amount: amount,
//       currency: "usd", // Assuming USD, change if needed
//       customer: customer_id,
//       description: description,
//       payment_method: customer.invoice_settings.default_payment_method,
//       off_session: true,
//       confirm: true,
//       metadata: {
//         type: "lesson-payment",
//       },
//     });

//     // If successful, return the PaymentIntent
//     res.json({ payment: paymentIntent });
//   } catch (error) {
//     console.error("Error:", error);

//     // Handle Stripe errors
//     if (error.type === "StripeError") {
//       res.status(400).json({
//         error: {
//           code: error.code,
//           message: error.message,
//         },
//         payment_intent_id: error.payment_intent?.id,
//       });
//     } else {
//       // Handle other errors
//       res.status(500).json({
//         error: {
//           code: "internal_server_error",
//           message: "An unexpected error occurred",
//         },
//       });
//     }
//   }
// });

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

// Milestone 2: '/complete-lesson-payment'
// Capture a payment for a lesson.
//
// Parameters:
// amount: (optional) amount to capture if different than the original amount authorized
//
// Example call:
// curl -X POST http://localhost:4242/complete_lesson_payment \
//  -d payment_intent_id=pi_XXX \
//  -d amount=4500
//
// Returns: a JSON response of one of the following forms:
//
// For a successful payment, return the payment intent:
//   {
//        payment: <payment_intent>
//    }
//
// for errors:
//  {
//    error:
//       code: the code returned from the error
//       message: the message returned from the error from Stripe
// }
//

// ################### My implementation #######################
// app.post("/complete-lesson-payment", async (req, res) => {
//   // TODO: Integrate Stripe
//   const { payement_intent_id, amount } = req.body;

//   let paymentIntent;
//   if (amount !== undefined) {
//     paymentIntent = await stripe.paymentIntents.update(payement_intent_id, {
//       amount: amount,
//     });
//   }
//   paymentIntent = await stripe.paymentIntents.capture(payement_intent_id);
//   res.json({payment : paymentIntent});
// });

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

// Milestone 2: '/refund-lesson'
// Refunds a lesson payment.  Refund the payment from the customer (or cancel the auth
// if a payment hasn't occurred).
// Sets the refund reason to 'requested_by_customer'
//
// Parameters:
// payment_intent_id: the payment intent to refund
// amount: (optional) amount to refund if different than the original payment
//
// Example call:
// curl -X POST http://localhost:4242/refund-lesson \
//   -d payment_intent_id=pi_XXX \
//   -d amount=2500
//
// Returns
// If the refund is successfully created returns a JSON response of the format:
//
// {
//   refund: refund.id
// }
//
// If there was an error:
//  {
//    error: {
//        code: e.error.code,
//        message: e.error.message
//      }
//  }

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
  // TODO: Retrieve the customer's payment method for the client
});

app.post("/update-payment-details/:customer_id", async (req, res) => {
  // TODO: Update the customer's payment details
});

// Handle account updates
app.post("/account-update", async (req, res) => {
  // TODO: Handle updates to any of the customer's account details
});

// Milestone 3: '/delete-account'
// Deletes a customer object if there are no uncaptured payment intents for them.
//
// Parameters:
//   customer_id: the id of the customer to delete
//
// Example request
//   curl -X POST http://localhost:4242/delete-account/:customer_id \
//
// Returns 1 of 3 responses:
// If the customer had no uncaptured charges and was successfully deleted returns the response:
//   {
//        deleted: true
//   }
//
// If the customer had uncaptured payment intents, return a list of the payment intent ids:
//   {
//     uncaptured_payments: ids of any uncaptured payment intents
//   }
//
// If there was an error:
//  {
//    error: {
//        code: e.error.code,
//        message: e.error.message
//      }
//  }
//
app.post("/delete-account/:customer_id", async (req, res) => {
  // TODO: Integrate Stripe
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
