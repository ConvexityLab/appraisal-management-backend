const fs = require('fs');
const path = 'src/mappers/canonical-to-uad.mapper.ts';
let content = fs.readFileSync(path, 'utf8');

const replacement = `    // UAD ratings
    qualityRating,
    conditionRating,
    propertyType,
    view: viewTypes,
    locationRating: (s.locationRating as UadSubjectProperty['locationRating']) ?? 'Neutral',
    
    // v1.3 Expanded Sections
    disasterMitigation: s.disasterMitigation as any,
    energyEfficiency: s.energyEfficiency as any,
    manufacturedHome: s.manufacturedHome as any,
    functionalObsolescence: s.functionalObsolescence as any,
    outbuildings: s.outbuildings as any,
    vehicleStorage: s.vehicleStorage as any,
    amenities: s.amenities as any,
    overallQualityCondition: s.overallQualityCondition as any,
    subjectListing: s.subjectListing as any,
    rentalInformation: s.rentalInformation as any,`;

content = content.replace(
    /    \/\/ UAD ratings\s*qualityRating,\s*conditionRating,\s*propertyType,\s*view: viewTypes,\s*locationRating: \(s\.locationRating as UadSubjectProperty\['locationRating'\]\) \?\? 'Neutral',/,
    replacement
);

fs.writeFileSync(path, content);
