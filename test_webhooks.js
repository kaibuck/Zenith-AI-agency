const axios = require('axios');

async function testCheckAvailability() {
  try {
    const response = await axios.post('http://localhost:3000/vapi/check-availability', {
      message: {
        toolCalls: [
          {
            id: 'call_123',
            function: {
              arguments: {
                preferredDateTime: 'Tomorrow at 10 AM'
              }
            }
          }
        ]
      }
    });
    console.log('Tool Call Response:', JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.error('Test failed:', err.message);
  }
}

async function testEndOfCall() {
    try {
      const response = await axios.post('http://localhost:3000/vapi/end-of-call', {
        message: {
          type: 'end-of-call-report',
          analysis: {
            structuredData: {
              customerName: 'John Doe',
              customerPhone: '+15550100',
              serviceType: 'Plumbing',
              appointmentDate: '2023-10-27',
              appointmentTime: '10:00 AM',
              serviceAddress: '123 Main St, Springfield'
            }
          }
        }
      });
      console.log('End of Call Response:', response.status);
    } catch (err) {
      console.error('Test failed:', err.message);
    }
}

// Run tests if server is up
// Note: Requires axios (npm install axios)
// I will just use a simple fetch if I don't want to install more deps, 
// but I'll install axios for convenience.
testCheckAvailability().then(testEndOfCall);
