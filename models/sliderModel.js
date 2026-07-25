const mongoose = require('mongoose');

const sliderSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Slider title is required.'],
        trim: true
    },
    text: {
        type: String,
        required: [true, 'Slider text is required.'],
        trim: true
    },
    imageUrl: {
        type: String,
        required: [true, 'Image URL is required.']
    },
    buttonText: {
        type: String,
        required: [true, 'Button text is required.'],
        trim: true
    },
    buttonLink: {
        type: String,
        required: [true, 'Button link is required.'],
        trim: true
    },
    position: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Sắp xếp theo vị trí khi truy vấn
sliderSchema.pre('find', function() {
    this.sort({ position: 'asc' });
});

const Slider = mongoose.model('Slider', sliderSchema);

module.exports = Slider;
