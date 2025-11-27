# Bank Statements

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
Bank Statements
Brokerage Statement
Brokerage Statement - Account Summary and Transactions
Brokerage Statement - Asset Allocation Summary
Closing
Disclosure
Identification
Income/Employment
Legal
Mortgage specific forms
Other
Property
Tax forms
Data types
Bank Statements
Suggest Edits

The Ocrolus API is most commonly leveraged to process PDF bank statements. It outlines the essential workflows involved in this process below.

To learn more about the processing of bank statements, see bank statements processing.

Upload PDF bank statements

To upload PDF bank statements:

Generate your API credentials as described in the Authentication section.
Create a new Book to upload all the bank statements for a given case.
Upload the PDF files to the Book. Reference the book_pk from the response of the create Book call. This will ensure that the files are organized within the appropriate Book.

Note:

We currently support bank statements from the United States, Canada, Mexico, and the United Kingdom.

Check for completion

Note:

While you can request results at any point, you will only receive data from documents with VERIFICATION_COMPLETE status.

In order to receive results from a case, poll for completion for documents in a Book. In this scenario, poll for Book status. Alternatively, configure a webhook to be notified when a document or Book is complete.

Extract results from a Book

Once processed, bank statements produce a JSON object. You can find details here. We have a basic rule to spot duplicates (deduplication logic). If two transactions that happened on the same date, have the same description, and the same amount in the same Book, then we consider one as a copy of the other. Also, we can adjust how closely the descriptions need to match. This flexibility lets us catch duplicates that might not be exactly the same word for word.

Updated over 1 year ago

SEE ALSO
Polling for completion
Analytics
Did this page help you?
Yes
No
TABLE OF CONTENTS
Upload PDF bank statements
Check for completion
Extract results from a Book
Home
Guides
API
Supported documents
Release notes

Ocrolus © 2025. All rights reserved. Legal | Privacy Policy