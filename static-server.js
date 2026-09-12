const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('Static server running on port ' + PORT);
  });
}

module.exports = app;
