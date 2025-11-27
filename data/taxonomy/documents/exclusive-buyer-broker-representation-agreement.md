# Exclusive Buyer-Broker Representation Agreement

Jump to Content
Start free trial
Raise a request
Guides
Recipes
API
Release notes
Supported documents
CTRL-K
Home
Guide
Quick start guides
Ocrolus API
Webhooks
Product guide
Encompass integration
Plaid integration
Supported documents
Getting started with supported documents
All supported documents
Assets
Closing
Disclosure
Automated Payments Customer Authorization
Exclusive Buyer-Broker Representation Agreement
Identification
Income/Employment
Legal
Mortgage specific forms
Other
Property
Tax forms
Data types
Exclusive Buyer-Broker Representation Agreement
Suggest Edits

This form is a contract between a prospective homebuyer and a real estate broker that grants the broker the exclusive right to represent the buyer in a real estate transaction. It defines the terms of the relationship, including the broker’s duties, compensation, and the duration of the agreement.

To use the Upload PDF endpoint for this document, you must use EXCLUSIVE_BUYER_BROKER_REPRESENTATION_AGREEMENT in the form_type parameter.

Field descriptions

The following fields are available on this document type:

JSON Attribute	Data Type	Description
exclusive_buyer_broker_representation_agreement-Part01-BuyerBrokerAndPropertyDetails:brokerName	Text	Broker Name
exclusive_buyer_broker_representation_agreement-Part01-BuyerBrokerAndPropertyDetails:designatedAgentName	Text	Designated Agent Name
exclusive_buyer_broker_representation_agreement-Part01-BuyerBrokerAndPropertyDetails:buyer1Name	Text	Buyer 1 Name
exclusive_buyer_broker_representation_agreement-Part01-BuyerBrokerAndPropertyDetails:buyer2Name	Text	Buyer 2 Name
exclusive_buyer_broker_representation_agreement-Part01-BuyerBrokerAndPropertyDetails:propertyAddress:addressLine1	Text	Property Address
exclusive_buyer_broker_representation_agreement-Part01-BuyerBrokerAndPropertyDetails:propertyAddress:addressLine2	Text	Property Address
exclusive_buyer_broker_representation_agreement-Part01-BuyerBrokerAndPropertyDetails:propertyAddress:city	Text	Property Address
exclusive_buyer_broker_representation_agreement-Part01-BuyerBrokerAndPropertyDetails:propertyAddress:state	State	Property Address
exclusive_buyer_broker_representation_agreement-Part01-BuyerBrokerAndPropertyDetails:propertyAddress:zip	ZIP Code	Property Address
exclusive_buyer_broker_representation_agreement-Part02-BrokerCompensation:commission:percentage	Percentage	Commission
exclusive_buyer_broker_representation_agreement-Part02-BrokerCompensation:commission:flatRate/FlatFeeCommission(AcquisitionFee/AcquisitionCommission)	Money	Commission
exclusive_buyer_broker_representation_agreement-Part02-BrokerCompensation:additionalBrokerageCommission	Money	Additional Brokerage Commission
exclusive_buyer_broker_representation_agreement-Part02-BrokerCompensation:hourlyRate	Money	Hourly Rate
exclusive_buyer_broker_representation_agreement-Part02-BrokerCompensation:non-refundableRetainerFee(Retainer)	Money	Non-Refundable Retainer Fee (Retainer)
exclusive_buyer_broker_representation_agreement-Part02-BrokerCompensation:mutualCancelationFee	Money	Mutual Cancelation Fee
exclusive_buyer_broker_representation_agreement-Part02-BrokerCompensation:buyerDefaultFee	Money	Buyer Default Fee
exclusive_buyer_broker_representation_agreement-Part03-DatesAndSignatures:agreementTerminationDate	Date	Agreement Termination Date
exclusive_buyer_broker_representation_agreement-Part03-DatesAndSignatures:buyer1Signature	SIGNED, NOT SIGNED	Buyer 1 Signature
exclusive_buyer_broker_representation_agreement-Part03-DatesAndSignatures:buyer1SignatureDate	Date	Buyer 1 Signature Date
exclusive_buyer_broker_representation_agreement-Part03-DatesAndSignatures:buyer2Signature	SIGNED, NOT SIGNED	Buyer 2 Signature
exclusive_buyer_broker_representation_agreement-Part03-DatesAndSignatures:buyer2SignatureDate	Date	Buyer 2 Signature Date
exclusive_buyer_broker_representation_agreement-Part03-DatesAndSignatures:broker/buyer(s)AgentSignature	SIGNED, NOT SIGNED	Broker/Buyer(s) Agent Signature
exclusive_buyer_broker_representation_agreement-Part03-DatesAndSignatures:broker/buyer(s)AgentName	Text	Broker/Buyer(s) Agent Name
Sample document
drive.google.com
EXCLUSIVE BUYER-BROKER REPRESENTATION AGREEMENT.pdf
Sample JSON result
JSON
{
  "pk": 60266207,
  "uuid": "ddb092ba-8563-4003-8cff-70390bd94861",
  "name": "EXCLUSIVE_BUYER_BROKER_REPRESENTATION_AGREEMENT",
  "created": "2025-04-18T20:04:30Z",
  "created_ts": "2025-04-18T20:04:30Z",
  "verified_pages_count": 6,
  "book_status": "ACTIVE",
  "id": 60266207,
  "forms": [
    {
      "pk": 66112749,
      "uuid": "a76396f4-b2b0-466b-8745-09799df84269",
      "uploaded_doc_pk": 95754775,
      "form_type": "EXCLUSIVE_BUYER_BROKER_REPRESENTATION_AGREEMENT",
      "form_config_pk": 1489535,
      "tables": [],
      "attribute_data": null,
      "raw_fields": {
        "exclusive_buyer_broker_representation_agreement-Part03-DatesAndSignatures:buyer1Signature": {
          "value": "SIGNED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "EXCLUSIVE BUYER-BROKER REPRESENTATION AGREEMENT.pdf",
          "confidence": 1.0
        },
        "exclusive_buyer_broker_representation_agreement-Part03-DatesAndSignatures:buyer2Signature": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "EXCLUSIVE BUYER-BROKER REPRESENTATION AGREEMENT.pdf",
          "confidence": 1.0
        },
        "exclusive_buyer_broker_representation_agreement-Part03-DatesAndSignatures:buyer1SignatureDate": {
          "value": "01/01/2025",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "EXCLUSIVE BUYER-BROKER REPRESENTATION AGREEMENT.pdf",
          "confidence": 1.0
        },
        "exclusive_buyer_broker_representation_agreement-Part03-DatesAndSignatures:buyer2SignatureDate": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "EXCLUSIVE BUYER-BROKER REPRESENTATION AGREEMENT.pdf",
          "confidence": 1.0
        },
        "exclusive_buyer_broker_representation_agreement-Part01-BuyerBrokerAndPropertyDetails:buyer1Name": {
          "value": "SAMPLE NAME 1",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "EXCLUSIVE BUYER-BROKER REPRESENTATION AGREEMENT.pdf",
          "confidence": 1.0
        },
        "exclusive_buyer_broker_representation_agreement-Part01-BuyerBrokerAndPropertyDetails:buyer2Name": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "EXCLUSIVE BUYER-BROKER REPRESENTATION AGREEMENT.pdf",
          "confidence": 1.0
        },
        "exclusive_buyer_broker_representation_agreement-Part03-DatesAndSignatures:broker/buyer(s)AgentName": {
          "value": "JOHN SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "EXCLUSIVE BUYER-BROKER REPRESENTATION AGREEMENT.pdf",
          "confidence": 1.0
        },
        "exclusive_buyer_broker_representation_agreement-Part03-DatesAndSignatures:broker/buyer(s)AgentSignature": {
          "value": "SIGNED",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "EXCLUSIVE BUYER-BROKER REPRESENTATION AGREEMENT.pdf",
          "confidence": 1.0
        },
        "exclusive_buyer_broker_representation_agreement-Part01-BuyerBrokerAndPropertyDetails:designatedAgentName": {
          "value": "JOHN SAMPLE",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "EXCLUSIVE BUYER-BROKER REPRESENTATION AGREEMENT.pdf",
          "confidence": 1.0
        },
        "exclusive_buyer_broker_representation_agreement-Part01-BuyerBrokerAndPropertyDetails:brokerName": {
          "value": "ANY SAMPLE BROKER NAME",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "EXCLUSIVE BUYER-BROKER REPRESENTATION AGREEMENT.pdf",
          "confidence": 1.0
        },
        "exclusive_buyer_broker_representation_agreement-Part03-DatesAndSignatures:agreementTerminationDate": {
          "value": "12/30/2025",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "EXCLUSIVE BUYER-BROKER REPRESENTATION AGREEMENT.pdf",
          "confidence": 1.0
        },
        "exclusive_buyer_broker_representation_agreement-Part01-BuyerBrokerAndPropertyDetails:propertyAddress:zip": {
          "value": "12345",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "EXCLUSIVE BUYER-BROKER REPRESENTATION AGREEMENT.pdf",
          "confidence": 1.0
        },
        "exclusive_buyer_broker_representation_agreement-Part01-BuyerBrokerAndPropertyDetails:propertyAddress:city": {
          "value": "ANY CITY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "EXCLUSIVE BUYER-BROKER REPRESENTATION AGREEMENT.pdf",
          "confidence": 1.0
        },
        "exclusive_buyer_broker_representation_agreement-Part01-BuyerBrokerAndPropertyDetails:propertyAddress:state": {
          "value": "NY",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "EXCLUSIVE BUYER-BROKER REPRESENTATION AGREEMENT.pdf",
          "confidence": 1.0
        },
        "exclusive_buyer_broker_representation_agreement-Part01-BuyerBrokerAndPropertyDetails:propertyAddress:addressLine1": {
          "value": "123 ANY STREET",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "EXCLUSIVE BUYER-BROKER REPRESENTATION AGREEMENT.pdf",
          "confidence": 1.0
        },
        "exclusive_buyer_broker_representation_agreement-Part01-BuyerBrokerAndPropertyDetails:propertyAddress:addressLine2": {
          "value": "APT #12",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "EXCLUSIVE BUYER-BROKER REPRESENTATION AGREEMENT.pdf",
          "confidence": 1.0
        },
        "exclusive_buyer_broker_representation_agreement-Part02-BrokerCompensation:hourlyRate": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "EXCLUSIVE BUYER-BROKER REPRESENTATION AGREEMENT.pdf",
          "confidence": 1.0
        },
        "exclusive_buyer_broker_representation_agreement-Part02-BrokerCompensation:buyerDefaultFee": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "EXCLUSIVE BUYER-BROKER REPRESENTATION AGREEMENT.pdf",
          "confidence": 1.0
        },
        "exclusive_buyer_broker_representation_agreement-Part02-BrokerCompensation:mutualCancelationFee": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "EXCLUSIVE BUYER-BROKER REPRESENTATION AGREEMENT.pdf",
          "confidence": 1.0
        },
        "exclusive_buyer_broker_representation_agreement-Part02-BrokerCompensation:commission:percentage": {
          "value": "5%",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "EXCLUSIVE BUYER-BROKER REPRESENTATION AGREEMENT.pdf",
          "confidence": 1.0
        },
        "exclusive_buyer_broker_representation_agreement-Part02-BrokerCompensation:additionalBrokerageCommission": {
          "value": "500.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "EXCLUSIVE BUYER-BROKER REPRESENTATION AGREEMENT.pdf",
          "confidence": 1.0
        },
        "exclusive_buyer_broker_representation_agreement-Part02-BrokerCompensation:non-refundableRetainerFee(Retainer)": {
          "value": "350.00",
          "is_empty": false,
          "alias_used": null,
          "source_filename": "EXCLUSIVE BUYER-BROKER REPRESENTATION AGREEMENT.pdf",
          "confidence": 1.0
        },
        "exclusive_buyer_broker_representation_agreement-Part02-BrokerCompensation:commission:flatRate/FlatFeeCommission(AcquisitionFee/AcquisitionCommission)": {
          "value": "",
          "is_empty": true,
          "alias_used": null,
          "source_filename": "EXCLUSIVE BUYER-BROKER REPRESENTATION AGREEMENT.pdf",
          "confidence": 1.0
        }
      }
    }
  ],
  "book_is_complete": true
}


Updated about 1 month ago

Automated Payments Customer Authorization
Identification
Did this page help you?
Yes
No
TABLE OF CONTENTS
Field descriptions
Sample document
Sample JSON result
Home
Guides
API
Supported documents
Release notes

Ocrolus © 2025. All rights reserved. Legal | Privacy Policy