## Stebridges BPO Order File Input Format:
OrderID	LoanID	CollateralNumber	ProductType	Occupancy	PropertyType	AddressLine1	AddressLine2	City	State	Zip	BorrowerName	LockboxCode


## Stebridges BPO Order RESULTS File Output Format (with example):
OrderID	LoanID	CollateralNumber	AddressLine1	AddressLine2	City	State	Zip	County	DateOrdered	DateCompleted	PropertyCondition	AsIsValue	RepairedValue
815541	0000603155	0	2909 Mississippi St		Paducah	KY	42003	MCCRACKEN	3/11/2024	3/14/2024	Fair	70000	82900


[1] are the PDF coming back from you 1-per Loan?   ( individual BPO files for each Loan in an order )

-and-

[2] Can we dictate the required naming convention for the PDFs you will return?

                ( assuming that item#1 above is yes )

 

The naming convention that our document storage vendor requires for automated uploads to their system

( which we will handle at our end ) looks like this…

 

<LoanID>_BPO_<collateral-Number>_<unique File-ID>.pdf

 

Where…

LoanID is our fully qualified 10-char LoanID with Leading zeros (example:   0000123456)

BPO is the identifying doc-type ID

Collateral-number ..passed to you in the Order data

Unique FileID  …can be anything that keeps 2-files from overwriting when LoanID, BPO and CollateralNumber values are all the same

                                                You can use an incremented value, an actauly unique FileID or a datetime stamp such as…   yyyymmdd#hhmmss

 

If we can get the PDFs back with compliant file-naming we can just move the files to our auto-upload path
where we deliver content to our online document repository vendor.