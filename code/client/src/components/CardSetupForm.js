<<<<<<< HEAD
import React, { useState } from "react";
import { CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import SignupComplete from "./SignupComplete";

const CardSetupForm = (props) => {
  const {
    selected,
    mode,
    details,
    customerId,
    learnerEmail,
    learnerName,
    onSuccessfulConfirmation,
  } = props;
=======
import {
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import React, { useState, useEffect } from "react";
import SignupComplete from "./SignupComplete";

const CardSetupForm = (props) => {
  const { selected, mode, details, customerId, learnerEmail, learnerName } =
    props;
>>>>>>> main
  const [paymentSucceeded, setPaymentSucceeded] = useState(false);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [last4, setLast4] = useState("");
<<<<<<< HEAD
=======
  const [cardComplete, setCardComplete] = useState(false);
>>>>>>> main

  const stripe = useStripe();
  const elements = useElements();

<<<<<<< HEAD
=======
  const handleChange = (event) => {
    if (event.error) {
      setError(event.error.message);
    } else {
      setError(null);
    }
    setCardComplete(event.complete);
  };

  const handleSuccessfulSetup = async (paymentMethodId) => {
    try {
      const response = await fetch(
        `/get-payment-method-details/${paymentMethodId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to retrieve payment method details");
      }

      const data = await response.json();
      setLast4(data.last4);
      setPaymentSucceeded(true);
    } catch (error) {
      setError("Failed to retrieve card information.");
    }
  };

>>>>>>> main
  const handleClick = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

<<<<<<< HEAD
    try {
      setProcessing(true);

      // Create PaymentMethod using card information
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card: elements.getElement(CardElement),
        billing_details: {
          email: learnerEmail,
          name: learnerName,
        },
      });

      if (error) {
        setError(error.message);
        setProcessing(false);
        return;
      }

      // PaymentMethod created successfully
      setLast4(paymentMethod.card.last4);
      setPaymentSucceeded(true);
      setProcessing(false);

      // Callback function to handle successful confirmation
      if (onSuccessfulConfirmation) {
        onSuccessfulConfirmation(paymentMethod);
      }
    } catch (error) {
      setError(error.message || "An error occurred during payment processing.");
=======
    setProcessing(true);
    setError(null);

    try {
      const result = await stripe.confirmSetup({
        elements,
        confirmParams: {
          payment_method_data: {
            billing_details: {
              name: learnerName,
              email: learnerEmail,
            },
          },
        },
        redirect: "if_required", // This will prevent automatic redirects
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      // Handle successful setup
      await handleSuccessfulSetup(result.setupIntent.payment_method);
    } catch (error) {
      setError(error.message);
    } finally {
>>>>>>> main
      setProcessing(false);
    }
  };

  if (selected === -1) return null;
<<<<<<< HEAD

  if (paymentSucceeded) {
    return (
      <div className="lesson-form">
=======
  if (paymentSucceeded)
    return (
      <div className={`lesson-form`}>
>>>>>>> main
        <SignupComplete
          active={paymentSucceeded}
          email={learnerEmail}
          last4={last4}
          customer_id={customerId}
        />
      </div>
    );
<<<<<<< HEAD
  }

  return (
    <div className="lesson-form">
      <div className="lesson-desc">
=======

  return (
    <div className={`lesson-form`}>
      <div className={`lesson-desc`}>
>>>>>>> main
        <h3>Registration details</h3>
        <div id="summary-table" className="lesson-info">
          {details}
        </div>
        <div className="lesson-legal-info">
          Your card will not be charged. By registering, you hold a session slot
          which we will confirm within 24 hrs.
        </div>
        <div className="lesson-grid">
          <div className="lesson-inputs">
            <div className="lesson-input-box first">
              <span>
                {learnerName} ({learnerEmail})
              </span>
            </div>
            <div className="lesson-payment-element">
<<<<<<< HEAD
              <label>Card details</label>
              <CardElement
                options={{
                  style: {
                    base: {
                      fontSize: "16px",
                      color: "#424770",
                      "::placeholder": {
                        color: "#aab7c4",
                      },
                    },
                    invalid: {
                      color: "#9e2146",
                    },
                  },
                  hidePostalCode: true,
                }}
              />
            </div>
            <button
              id="checkout-btn"
              disabled={!stripe || processing}
              onClick={handleClick}
            >
              <span id="button-text">
                {processing ? "Processing..." : "Checkout"}
              </span>
            </button>
=======
              <PaymentElement id="payment-element" onChange={handleChange} />
              <button
                id="submit"
                type="button"
                onClick={handleClick}
                disabled={!stripe || processing || !cardComplete}
              >
                {processing ? (
                  <>
                    <span
                      id="spinner"
                      className="spinner"
                      style={{
                        display: "inline-block",
                        width: "20px",
                        height: "20px",
                        border: "3px solid rgba(255,255,255,.3)",
                        borderRadius: "50%",
                        borderTopColor: "#fff",
                        animation: "spin 1s ease-in-out infinite",
                        WebkitAnimation: "spin 1s ease-in-out infinite",
                        marginRight: "10px",
                      }}
                    ></span>
                    Processing...
                  </>
                ) : (
                  "Complete Registration"
                )}
              </button>
            </div>
>>>>>>> main
          </div>
        </div>
        {error && (
          <div className="sr-field-error" id="card-errors" role="alert">
            <div className="card-error" role="alert">
              {error}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CardSetupForm;
