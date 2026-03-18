const fs = require('fs');
const uadPath = 'src/types/uad-3.6.ts';
let txt = fs.readFileSync(uadPath, 'utf8');

txt = txt.replace(/  \/\/ --- New v1\.3 Sections ---\s*disasterMitigation\?: UadDisasterMitigation;\s*energyEfficiency\?: UadEnergyEfficiency;\s*manufacturedHome\?: UadManufacturedHome;\s*functionalObsolescence\?: UadFunctionalObsolescenceItem\[\];\s*outbuildings\?: UadOutbuilding\[\];\s*vehicleStorage\?: UadVehicleStorage\[\];\s*amenities\?: UadPropertyAmenity\[\];\s*overallQualityCondition\?: UadOverallQualityCondition;\s*subjectListing\?: UadSubjectListing;\s*rentalInformation\?: UadRentalInformation;\s*/g, '');

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

let uadAppraisalRegex = /(export interface UadAppraisalReport \{[\s\S]*?)(  \})/g;
txt = txt.replace(uadAppraisalRegex, `$1${addedToAppraisal}$2`);

fs.writeFileSync(uadPath, txt);
