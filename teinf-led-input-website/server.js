const express = require('express');
const mqtt = require('mqtt');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;
// MQTT broker setup with port 1883
const mqttBroker = 'mqtt://tome.lu:1883'; // Using non-secure connection with port 1883
const mqttUser = 'eco';
const mqttPassword = 'marathon';
const mqttClient = mqtt.connect(mqttBroker, {
  username: mqttUser,
  password: mqttPassword,
});
// Initialize LED state with 16 LEDs as shown in your MQTT data
let ledState = [
  { "r": 255, "g": 0, "b": 0 },
  { "r": 255, "g": 64, "b": 0 },
  { "r": 255, "g": 127, "b": 0 },
  { "r": 255, "g": 191, "b": 0 },
  { "r": 255, "g": 255, "b": 0 },
  { "r": 127, "g": 255, "b": 0 },
  { "r": 0, "g": 255, "b": 0 },
  { "r": 0, "g": 255, "b": 127 },
  { "r": 0, "g": 255, "b": 255 },
  { "r": 0, "g": 127, "b": 255 },
  { "r": 0, "g": 0, "b": 255 },
  { "r": 75, "g": 0, "b": 130 },
  { "r": 148, "g": 0, "b": 211 },
  { "r": 191, "g": 0, "b": 127 },
  { "r": 255, "g": 0, "b": 255 },
  { "r": 255, "g": 0, "b": 64 }
];
// Middleware to parse JSON body
app.use(bodyParser.json());
// Serve static files (HTML, CSS, JS)
app.use(express.static('public'));
// Route to serve the main page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});
// Route to get current LED state
app.get('/ledstate', (req, res) => {
  res.json(ledState);
});

// IMPORTANT: The "all" route must come BEFORE the ":id" route
// Route to set all LEDs to the same color
app.post('/led/all/color', (req, res) => {
  console.log('Received set all request:', req.body);
  
  const rgbColor = req.body; // Expecting { r: 255, g: 0, b: 0 } format
 
  // Fix: Use Number() instead of parseInt() to properly handle numeric values
  const r = Number(rgbColor.r);
  const g = Number(rgbColor.g);
  const b = Number(rgbColor.b);
 
  // Debug: Log parsed values
  console.log('Parsed RGB values:', r, g, b);
  
  // Validate RGB values
  if (isNaN(r) || isNaN(g) || isNaN(b) ||
      r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
    console.log('Invalid RGB values:', r, g, b);
    return res.status(400).send('Invalid RGB values: values must be between 0-255');
  }
 
  // Update all LEDs in the state array
  for (let i = 0; i < ledState.length; i++) {
    ledState[i] = { "r": r, "g": g, "b": b };
  }
 
  // Publish the entire LED state array to MQTT using the "led" topic
  const publishOptions = { qos: 2 };
  mqttClient.publish('led', JSON.stringify(ledState), publishOptions, () => {
    console.log(`All LEDs color set to R:${r} G:${g} B:${b}`);
    res.send(`All LEDs color updated successfully`);
  });
});

// Route to control individual LED colors (COMES AFTER the "all" route)
app.post('/led/:id/color', (req, res) => {
  const ledId = parseInt(req.params.id);  // LED number (1-16)
 
  if (isNaN(ledId) || ledId < 1 || ledId > 16) {
    return res.status(400).send('Invalid LED ID');
  }
 
  const rgbColor = req.body; // Expecting { r: 255, g: 0, b: 0 } format
 
  // Fix: Ensure RGB values are numbers
  const r = Number(rgbColor.r);
  const g = Number(rgbColor.g);
  const b = Number(rgbColor.b);
 
  // Validate RGB values
  if (isNaN(r) || isNaN(g) || isNaN(b) ||
      r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
    return res.status(400).send('Invalid RGB values: values must be between 0-255');
  }
 
  // Update the LED state array (using ledId-1 to convert to zero-based index)
  ledState[ledId-1] = { "r": r, "g": g, "b": b };
 
  // Publish the entire LED state array to MQTT using the "led" topic
  // Set QoS level to 2 for exactly-once delivery
  const publishOptions = { qos: 2 };
  mqttClient.publish('led', JSON.stringify(ledState), publishOptions, () => {
    console.log(`LED${ledId} color set to R:${r} G:${g} B:${b}`);
    res.send(`LED${ledId} color updated successfully`);
  });
});

// Handle MQTT connection events
mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
 
  // Subscribe to the LED topic to get updates with QoS 2
  mqttClient.subscribe('led', { qos: 2 }, (err) => {
    if (!err) {
      console.log('Subscribed to led topic with QoS 2');
    }
  });
});
mqttClient.on('message', (topic, message) => {
  if (topic === 'led') {
    try {
      // Update our local state when messages come in
      const receivedState = JSON.parse(message.toString());
      if (Array.isArray(receivedState)) {
        ledState = receivedState;
        console.log('LED state updated from MQTT');
      }
    } catch (error) {
      console.error('Error parsing MQTT message:', error);
    }
  }
});
mqttClient.on('error', (error) => {
  console.error('MQTT connection error:', error);
});
// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});