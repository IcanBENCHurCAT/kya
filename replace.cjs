const fs = require('fs');

const file3 = '__tests__/screening.test.ts';
let content3 = fs.readFileSync(file3, 'utf8');

content3 = content3.replace(/'PASS'/g, "'NO_MATCH_FOUND'");
content3 = content3.replace(/'FAIL'/g, "'POTENTIAL_MATCH'");
content3 = content3.replace(/'FLAGGED'/g, "'MATCH_REQUIRES_REVIEW'");
content3 = content3.replace(/\bcompliance\b(?! gates)/g, 'screeningResult');
content3 = content3.replace(/\.pass\b/g, '.noMatchFound');
content3 = content3.replace(/\.fail\b/g, '.potentialMatch');
content3 = content3.replace(/\.flagged\b/g, '.requiresReview');
content3 = content3.replace(/Verify compliance gates/g, 'Verify screening gates');

fs.writeFileSync(file3, content3);

const file4 = '__tests__/a2a.test.ts';
let content4 = fs.readFileSync(file4, 'utf8');

content4 = content4.replace(/'PASS'/g, "'NO_MATCH_FOUND'");
content4 = content4.replace(/\bsanctionsPass\b/g, 'noSanctionsMatch');

fs.writeFileSync(file4, content4);

const file5 = '__tests__/deployment.test.ts';
let content5 = fs.readFileSync(file5, 'utf8');

content5 = content5.replace(/compliance/g, 'screening'); // Verify no "compliance" language in test descriptions

fs.writeFileSync(file5, content5);
