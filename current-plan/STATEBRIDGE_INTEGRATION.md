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



### Statebridghe Order Example:
OrderID|LoanID|CollateralNumber|ProductType|Occupancy|PropertyType|AddressLine1|AddressLine2|City|State|Zip|BorrowerName|LockboxCode
1|6420340020|0|Appraisal|Owner Occupied|Single Family|4501 QUEENS RD||GASTONIA|NC|28052|MARIO XXXXX|0020
2|6420639024|0|Hybrid BPO|Non-Owner Occupied|Other|8511 NORTH GRAY ST||INDIANAPOLIS|IN|46201|JERMEY XXXXXX|9024
3|6420639024|1|Hybrid BPO|Non-Owner Occupied|Other|8640 NORTH GRAY ST||INDIANAPOLIS|IN|46201|JERMEY XXXXXX|9024
4|6420639024|2|Hybrid BPO|Non-Owner Occupied|Other|1714-716 CONGRESS AVE||INDIANAPOLIS|IN|46208|JERMEY XXXXXX|9024
5|6420639024|3|Hybrid BPO|Non-Owner Occupied|Other|73316 RALSTON AVE||INDIANAPOLIS|IN|46218|JERMEY XXXXXX|9024
6|6420639024|4|Hybrid BPO|Non-Owner Occupied|Other|7118-120 NEAL AVE||INDIANAPOLIS|IN|46222|JERMEY XXXXXX|9024
7|6420639024|5|Hybrid BPO|Non-Owner Occupied|Other|8201 S HARRISON ST||SHELBYVILLE|IN|46176|JERMEY XXXXXX|9024
8|6420639024|6|Hybrid BPO|Non-Owner Occupied|Other|713 W BROADWAY ST||SHELBYVILLE|IN|46176|JERMEY XXXXXX|9024
9|6420639024|7|Hybrid BPO|Non-Owner Occupied|Other|715 W BROADWAY ST||SHELBYVILLE|IN|46176|JERMEY XXXXXX|9024
10|6420639101|0|Hybrid BPO|Non-Owner Occupied|Townhouse|61317 CHARLES ST||INDIANAPOLIS|IN|46225|JERMEY XXXXXX|9101
11|6420639101|2|Hybrid BPO|Owner Occupied|Townhouse|42409-2411 N DEARBORN ST||INDIANAPOLIS|IN|46218|JERMEY XXXXXX|9101
12|6420639101|3|Hybrid BPO|Owner Occupied|Townhouse|42413-2415 N DEARBORN ST||INDIANAPOLIS|IN|46218|JERMEY XXXXXX|9101
13|6420653189|0|BPO|Owner Occupied|Single Family|814066 SW 272ND ST||HOMESTEAD|FL|33032|SAYLIER XXXXXXXXXXXXXX|3189
14|6420653277|0|BPO|Owner Occupied|Single Family|8873 NEAR CREEK DR||BLYTHEWOOD|SC|29016|JONIQUE XXXXXXXXXXXXX|3277
15|6420653583|0|BPO|Owner Occupied|Single Family|74026 COLLEGE AVE||KANSAS CITY|MO|64130|JACOB-KELLY XXXXX|3583
16|6420662815|0|AVM|Vacant|Single Family|390 KAREN AVE||WATERBURY|CT|06708|MARY XXXX|2815
17|6420670900|0|BPO|Owner Occupied|Single Family|35 E BRUBAKER VALLEY RD||LITITZ|PA|17543|STEPHANIE XXXXX|0900
18|6420693709|0|BPO|Owner Occupied|Single Family|997 ROYAL GRANT WAY||DOVER|DE|19901|Barbie XXXXXX|3709
19|6420709171|0|Hybrid BPO|Owner Occupied|Multi-Family 2-4 Uni|716077 LAMONTE DR||HAMMOND|LA|70403| XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX|9171
20|6420709186|0|Hybrid BPO|Non-Owner Occupied|Single Family|41212 ANGUS DR||HARVEY|LA|70058| XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX|9186
21|6420709186|2|Hybrid BPO|Owner Occupied|Single Family|416 CYNTHIA ST||AVONDALE|LA|70094| XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX|9186
22|6420709186|3|Hybrid BPO|Owner Occupied|Single Family|616 DAVENPORT ST||WESTWEGO|LA|70094| XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX|9186
23|6420709186|4|Hybrid BPO|Owner Occupied|Single Family|2125 11TH ST||BRIDGE CITY|LA|70094| XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX|9186
24|6420709186|5|Hybrid BPO|Owner Occupied|Single Family|3357 HELIS RD||AVONDALE|LA|70094| XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX|9186
25|6420709186|6|Hybrid BPO|Owner Occupied|Single Family|2604 RUTH DR||BRIDGE CITY|LA|70094| XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX|9186
26|6420709186|7|Hybrid BPO|Owner Occupied|Single Family|54105 LAC SAINT PIERRE DR||HARVEY|LA|70058| XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX|9186
27|6420709186|8|Hybrid BPO|Owner Occupied|Single Family|67840 HEATHER ST||BRIDGE CITY|LA|70094| XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX|9186
28|6420709186|9|Hybrid BPO|Owner Occupied|Single Family|114344 KOHNKE HILL RD||HAMMOND |LA|70401| XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX|9186
29|6420713840|0|Hybrid BPO|Unknown/Other|Single Family|9110 BELLEFAIR LANE||WEST CHESTER|PA|19382|XXXXXXXXXXXXXXXXXXXXXXX|3840
30|6420713888|0|Hybrid BPO|Owner Occupied|Multi-Family 2-4 Uni|5165 NW 39TH ST||MIAMI|FL|33127|XXXXXXXXXXXXXXXXXXXXXX|3888
31|6420749687|0|BPO|Owner Occupied|Townhouse|91091 TUCKER AVE SW|UNIT 102|ATLANTA|GA|30310|DERICK XXXXXXX|9687
32|6420751750|0|BPO|Owner Occupied|Single Family|315988 COUNTY ROAD 4 NE||SPICER|MN|56288|ASHLEY XXXXXXXX|1750