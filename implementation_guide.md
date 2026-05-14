# Zenith HVAC & Plumbing - Automation Implementation Guide

This document outlines the implementation details for the automation workflows using Make.com, Vapi, Twilio, and Google Calendar.

## 1. Vapi Configuration

### Agent Setup
- **System Prompt**: Use the content of `vapi_system_prompt.md`.
- **Tools**: Add a tool named `check_availability`.
    - **Method**: POST
    - **URL**: `[Make.com Webhook URL A]`
    - **Parameters**: `preferredDateTime` (string)

### End of Call Report
- **Webhook URL**: `[Make.com Webhook URL B]`
- **Report Type**: `end-of-call-report`
- **Structured Data Extraction**:
    - `customerName`
    - `customerPhone`
    - `serviceType`
    - `appointmentDate`
    - `appointmentTime`
    - `serviceAddress`

---

## 2. Make.com Scenarios

### Scenario A: Availability Check
1.  **Custom Webhook**: Receives tool call from Vapi.
2.  **Google Calendar - List Events**: Search for events in the requested time range.
3.  **Router**:
    - **If Slot Free**: Return `{"isAvailable": true}`.
    - **If Slot Busy**: Return `{"isAvailable": false, "suggestedSlots": [...]}`.
4.  **Webhook Response**: Sends the JSON back to Vapi.

### Scenario B: Booking & Notifications (Triggered by End of Call)
1.  **Custom Webhook**: Receives `end-of-call-report`.
2.  **Google Calendar - Create an Event**: Use extracted data to book the slot.
3.  **Data Store - Add Record**: Key: `customerPhone`, Value: `eventId`.
4.  **Twilio - Send SMS (Owner)**: Notify the owner about the new job.
5.  **Twilio - Send SMS (Customer)**: Send confirmation + "OPT OUT" instructions.

### Scenario C: Cancellation (Triggered by Twilio SMS)
1.  **Twilio - Watch Messages**: Triggered on inbound SMS.
2.  **Filter**: If message contains "OPT OUT".
3.  **Data Store - Get Record**: Retrieve `eventId` using sender's phone number.
4.  **Google Calendar - Delete an Event**: Use the retrieved `eventId`.
5.  **Twilio - Send SMS (Owner)**: Notify owner of cancellation.
6.  **Data Store - Delete Record**: Clean up the mapping.

### Scenario D: 3-Hour Reminder
1.  **Google Calendar - Search Events**: Scheduled to run every hour.
2.  **Filter**: Events starting in exactly 3 hours.
3.  **Twilio - Send SMS (Customer)**: Send reminder.

---

## 3. Required Credentials
The following are needed to finalize the implementation:
1.  **Twilio**: Account SID, Auth Token, and a SMS-enabled Phone Number.
2.  **Google Calendar**: Access to the target calendar (OAuth connection).
3.  **Vapi**: API Key for agent deployment.
4.  **Owner Mobile Number**: For internal notifications.
