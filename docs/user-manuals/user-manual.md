# Student Health Hub

## Enumerator User Manual

**Version:** 1.0

**Purpose:** Guide enumerators through student data collection, offline submissions, and synchronization.

### 1. Introduction

Student Health Hub is a web-based application designed to support student health data collection. It allows enumerators to submit student screening information and supports offline storage when an internet connection is unavailable.

### 2. Getting Started

1. Open Student Health Hub using the link provided by the project administrator.
2. Sign in using your assigned account.
3. Navigate to the student registration or screening section.
4. Ensure you are using the correct organization or project account.

### 3. Registering a Student

1. Open the student registration page.
2. Enter the required student information in the appropriate fields.
3. Check that the information is accurate and complete.
4. Submit the registration.
5. Wait for the application to display the submission status.

**Important:** Avoid submitting the same student's information repeatedly.

### 4. Working Without Internet

The application supports offline submission using browser-based IndexedDB storage on the device.

1. Open the application while connected to the internet at least once.
2. If the connection is lost, continue entering the student's information.
3. Submit the completed form.
4. The application stores the submission locally on this device.
5. Check the pending submission indicator or status.

**Important:** Do not clear browser data or uninstall the application before pending submissions have synchronized. Offline submissions stored on this device are not available on another device or browser.

### 5. Automatic Synchronization

When internet connectivity returns:

1. Keep the application open.
2. The application detects the restored connection.
3. Pending submissions are automatically sent to the server through your signed-in account.
4. Check the status displayed for each submission.

Possible statuses:

- **Pending:** Waiting to synchronize.
- **Syncing:** Being uploaded.
- **Synced:** Successfully saved on the server.
- **Failed:** Synchronization needs attention.
- **Conflict:** The submission requires review.

### 6. Duplicate Submission Prevention

Each locally saved submission receives a unique identifier. The application reuses that identifier during retries to help prevent duplicate records.

Enumerators should:

- Avoid repeatedly pressing **Submit**.
- Check the existing submission status before trying again.
- Contact the administrator if a duplicate warning appears.

### 7. Handling Synchronization Conflicts

A conflict can occur when an offline submission does not match an existing server record.

1. Open the conflict details shown by the application.
2. Read the displayed conflict reason and compare the available server information.
3. Use **Keep server version** only after confirming that the server record should be retained.
4. Contact the administrator if the correct record is unclear.

The application does not overwrite the server record. When you choose **Keep server version**, the local submission is marked resolved but remains stored on this device and will not be synchronized.

### 8. Troubleshooting

| Problem | Recommended action |
|---|---|
| Internet unavailable | Save the submission offline and wait for reconnection. |
| Submission remains pending | Check connectivity and keep the application open. |
| Submission shows Failed | Review the displayed error and contact the administrator if needed. |
| Conflict appears | Review the conflict details before resolving it. |
| Duplicate warning | Do not submit repeatedly; contact the administrator. |
| Application does not load | Check the internet connection and reopen the application. |

### 9. Enumerator Best Practices

- Verify student information before submission.
- Use only your authorized account.
- Do not share login credentials.
- Avoid clearing browser storage while submissions are pending.
- Confirm that important submissions show **Synced**.
- Report unresolved errors to the project administrator.
- Protect student information and follow the organization's data privacy procedures.

### 10. Conclusion

Student Health Hub supports student screening data collection with offline storage, automatic synchronization, duplicate prevention, and conflict handling. Check submission statuses regularly to ensure that collected information has been safely synchronized.
