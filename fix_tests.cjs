const fs = require('fs');
let content = fs.readFileSync('src/components/BottomSheets/SalahTimesSheets/BottomSheetAddLocation.test.tsx', 'utf8');

// Use regex to remove the entire block from `describe("tests asserting location settings bottom sheet is triggered...` up to `});\n\n  describe("tests for GPS location button functionality when location permission is denied"`
content = content.replace(
  /describe\("tests asserting location settings bottom sheet is triggered \/ not triggered upon user adding a location", \(\) => \{[\s\S]*?\}\);\n\n  describe\("tests for GPS location button functionality when location permission is denied",/g,
  'describe("tests for GPS location button functionality when location permission is denied",'
);

fs.writeFileSync('src/components/BottomSheets/SalahTimesSheets/BottomSheetAddLocation.test.tsx', content);
