const fs = require('fs');
let content = fs.readFileSync('routes/adminRoutes.js', 'utf8');

if (!content.includes('const upload = require')) {
    content = content.replace("const Order = require('../models/orderModel');", "const Order = require('../models/orderModel');\nconst upload = require('../middleware/uploadMiddleware');");
}

content = content.replace(
    /router\.post\('\/add-item', async \(req, res\) => \{\s+try \{\s+const \{ itemType, name, description, imageUrl, price, stock \} = req\.body;/,
    `router.post('/add-item', upload.single('imageFile'), async (req, res) => {
    try {
        const { itemType, name, description, price, stock } = req.body;
        let imageUrl = req.body.imageUrl;
        if (req.file) {
            imageUrl = '/images/uploads/' + req.file.filename;
        }`
);

fs.writeFileSync('routes/adminRoutes.js', content);
