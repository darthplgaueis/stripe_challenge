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
  const [paymentSucceeded, setPaymentSucceeded] = useState(false);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [last4, setLast4] = useState("");

  const stripe = useStripe();
  const elements = useElements();

  const handleClick = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

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
      setProcessing(false);
    }
  };

  if (selected === -1) return null;

  if (paymentSucceeded) {
    return (
      <div className="lesson-form">
        <SignupComplete
          active={paymentSucceeded}
          email={learnerEmail}
          last4={last4}
          customer_id={customerId}
        />
      </div>
    );
  }

  return (
    <div className="lesson-form">
      <div className="lesson-desc">
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
