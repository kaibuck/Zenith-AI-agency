/**
 * Business Configuration
 * Duplicate this file and change these values for each new business client.
 * All values can also be overridden at runtime via the Admin Dashboard → Settings.
 */
module.exports = {
  name: process.env.BUSINESS_NAME || 'Sunrise Wellness Spa',
  tagline: process.env.BUSINESS_TAGLINE || 'Your relaxation destination',
  phone: process.env.SIGNALWIRE_PHONE_NUMBER || '+15551234567',
  ownerPhone: process.env.OWNER_PHONE || '+15559876543',
  ownerEmail: process.env.OWNER_EMAIL || 'owner@example.com',
  timezone: process.env.BUSINESS_TIMEZONE || 'America/New_York',
  calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',

  // Business hours (24-hour format). Set open/close to null for closed days.
  hours: {
    sunday: null,
    monday: { open: '09:00', close: '17:00' },
    tuesday: { open: '09:00', close: '17:00' },
    wednesday: { open: '09:00', close: '17:00' },
    thursday: { open: '09:00', close: '17:00' },
    friday: { open: '09:00', close: '17:00' },
    saturday: { open: '10:00', close: '15:00' },
  },

  // Services offered. duration is in minutes, price in USD.
  services: [
    { name: 'Swedish Massage', duration: 60, price: 85 },
    { name: 'Deep Tissue Massage', duration: 90, price: 110 },
    { name: 'Hot Stone Massage', duration: 75, price: 100 },
    { name: 'Aromatherapy Facial', duration: 60, price: 90 },
    { name: 'Couples Massage', duration: 90, price: 190 },
    { name: 'Express Facial', duration: 30, price: 55 },
    { name: 'Consultation', duration: 30, price: 0 },
  ],

  // Words that trigger urgent-call handling (offer to transfer to owner)
  urgentKeywords: ['emergency', 'urgent', 'immediately', 'right now', 'asap', 'pain', 'accident'],

  // Transfer number for urgent calls (can be same as ownerPhone)
  transferPhone: process.env.TRANSFER_PHONE || process.env.OWNER_PHONE || '+15559876543',

  // Voice used for text-to-speech (Polly voices: Joanna, Kendra, Kimberly, Salli, Joey, Matthew)
  voice: 'Polly.Joanna',

  // Conversation session expires after this many seconds of inactivity (1 hour)
  sessionTimeoutSeconds: 3600,
};
