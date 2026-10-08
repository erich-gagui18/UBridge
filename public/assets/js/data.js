export const TYPES = ['Cheating / Dishonesty','Disrespectful Conduct','Dress Code Violation','Vandalism','Other'];
// Sample handbook answers. Replace askGuide() in pages/ai-guide.js with your RAG endpoint.
export const KB = [
 {k:['hair','color','colour','dye'],src:'Section XI · Grooming and appearance',text:'Bold hair colors are not allowed for both male and female students. Students are expected to follow the university’s grooming and appearance guidelines while inside the campus.'},
 {k:['uniform','dress','attire','id'],src:'Section XI · Campus dress code',text:'Students are expected to wear the prescribed uniform properly while inside the campus.',sample:1},
 {k:['minor','major','grave','difference','category','offense','offence'],src:'Section VII · Offense categories',text:'Offenses are grouped into minor, major and grave based on how serious they are. Higher categories carry heavier sanctions.',sample:1}
];
// Set the SAEP Office email to enable the floating 'Contact SAEP' button (falls back to the FAQ when empty).
export const CONTACT = {email: ''};
