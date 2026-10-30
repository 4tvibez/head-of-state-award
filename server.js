const app = require("./api/index");
const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log("Head of State Award site running on port " + PORT));
