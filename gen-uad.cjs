const fs = require('fs');

const canPath = 'src/types/canonical-schema.ts';
const uadPath = 'src/types/uad-3.6.ts';

let canText = fs.readFileSync(canPath, 'utf8');
let uadText = fs.readFileSync(uadPath, 'utf8');

let regex = /export interface Canonical(DisasterMitigationItem|DisasterMitigation|EnergyFeature|EnergyEfficiency|ManufacturedHome|FunctionalObsolescenceItem|OutbuildingFeature|Outbuilding|VehicleStorage|PropertyAmenity|FeatureQC|OverallQualityCondition|SubjectListing|RentalInformation|UnitRentalInfo)(?:[^{]*)?\{[\s\S]*?\n\}/g;

let matches = canText.match(regex);
if (!matches) { console.log('no matches'); process.exit(0); }

let newInterfaces = matches.map(m => m.replace(/Canonical/g, 'Uad')).join('\n\n');

let uadAppraisalRegex = /(export interface UadAppraisalReport \{[\s\S]*?)(  \})/g;
let addedToAppraisal = `
  // --- New v1.3 Sections ---
  disasterMitigation?: UadDisasterMitigation;
  energyEfficiency?: UadEnergyEfficiency;
  manufacturedHome?: UadManufacturedHome;
  functionalObsolescence?: UadFunctionalObsolescenceItem[];
  outbuildings?: UadOutbuilding[];
  vehicleStorage?: UadVehicleStorage[];
  amenities?: UadPropertyAmenity[];
  overallQualityCondition?: UadOverallQualityCondition;
  subjectListing?: UadSubjectListing;
  rentalInformation?: UadRentalInformation;
`;

uadText = uadText.replace(uadAppraisalRegex, `$1${addedToAppraisal}$2`);
uadText += "\n\n// --- NEW UAD 3.6 SECTIONS ---\n\n" + newInterfaces + "\n";

fs.writeFileSync(uadPath, uadText);
console.log('Appended interfaces to uad-3.6.ts');
