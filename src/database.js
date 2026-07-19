const BLUETOOTH_LATENCY_DB = {
  'AirPods (1st Generation)': 100,
  'AirPods (2nd Generation)': 60,
  'AirPods (3rd Generation)': 50,
  'AirPods Pro (1st Generation)': 50,
  'AirPods Pro (2nd Generation)': 40,
  'AirPods Max': 40,
  'Powerbeats Pro': 55,
  'Beats Solo Pro': 65,
  'Beats Studio Pro': 50,
  'Sony WH-1000XM5': 80,
  'Sony WH-1000XM4': 85,
  'Sony WF-1000XM5': 70,
  'Sony WF-1000XM4': 75,
  'Sony WH-CH720N': 90,
  'Bose QuietComfort 45': 75,
  'Bose QuietComfort Ultra': 70,
  'Bose QuietComfort Earbuds II': 65,
  'JBL Live 660NC': 90,
  'Samsung Galaxy Buds Pro': 65,
  'Google Pixel Buds Pro': 85,
  'Default': 80
};

export function getLatencyFromDB(model) {
  if (!model) return BLUETOOTH_LATENCY_DB.Default;
  const modelLower = model.toLowerCase();
  for (const [key, latency] of Object.entries(BLUETOOTH_LATENCY_DB)) {
    if (key.toLowerCase() === modelLower ||
        modelLower.includes(key.toLowerCase()) ||
        key.toLowerCase().includes(modelLower)) {
      return latency;
    }
  }
  return BLUETOOTH_LATENCY_DB.Default;
}

export function updateLatencyDB(model, latency) {
  BLUETOOTH_LATENCY_DB[model] = latency;
}

export default BLUETOOTH_LATENCY_DB;
