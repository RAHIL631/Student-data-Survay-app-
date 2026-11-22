# Student Health Hub user manual

## About the application

Student Health Hub is an online workspace for authorized organization administrators, district managers, and enumerators. Available records and actions depend on the signed-in profile, assigned district/session, and Supabase Row Level Security (RLS). A page or URL alone does not grant access.

Production sign-in and student screening require an internet connection. Offline submission, background synchronization, PWA installation, and Android packaging are not currently implemented.

## Sign in and account recovery

1. Open the application URL provided by your organization.
2. Sign in using the email and password for the account provisioned by an administrator.
3. If you cannot sign in, use **Forgot password?** and follow the recovery email. Use the same browser to return through the recovery link and set a new password.
4. Contact an organization administrator if the account is not provisioned, inactive, or associated with the wrong organization/district. Do not create a second Auth account to work around a profile issue.
5. Use **Sign out** when finished, especially on a shared device.

## Organization administrators

Organization administrators can use the organization dashboard and authorized administration pages. The Users page supports staff invitation and account activation controls. Invitations are completed through the application's invitation flow; recipients should use the email sent to them to accept and set their password. Administrators cannot activate/deactivate their own profile through the account activation action.

Use the Settings page for account activation controls. An inactive profile is denied protected database operations and is signed out by the application. Contact another organization administrator to restore access.

## District managers

District managers work within their assigned district. They can use the application pages allowed for that role, such as managing their scoped screening work and inviting enumerators where enabled. They do not have access to organization-admin user management or other districts' records.

## Enumerators

Enumerators work with screening sessions assigned to them. Open **Screening Sessions**, choose an available assigned session, then use the screening workflow to record student information. Enter the organization's SI number manually. The application reserves that number before creating or changing the student record; a conflict means the number is already used or temporarily reserved. Do not change to a different number without following your organization's records process.

Check the submitted screening status. Required screening observations and measurements are validated by the application. Do not repeatedly submit a record when an error appears; check whether it was saved and contact the administrator if the state is unclear.

## Reports and exports

The Reports page displays the student screening records available to your signed-in account. It retains CSV export and also provides Excel (`.xlsx`) and PDF export. Each file contains only the records returned to the page through the account's authorized, RLS-scoped service calls. If report data fails to load, resolve the error and retry before exporting.

Reports can contain sensitive student information. Download only when needed, protect the file from other users, follow your organization's retention and sharing rules, and delete local copies when permitted. Do not send reports through personal email or public file-sharing services.

## Data protection and troubleshooting

- Use only your assigned account; never share passwords or recovery links.
- Verify student, school, session, and SI details before saving.
- Avoid public or shared devices. Sign out and close the browser when finished.
- Protect exported CSV, Excel, and PDF files as sensitive records.
- The production application does not save submissions offline. If the connection is unavailable, wait until it returns before entering or submitting real student information.
- If a profile, permission, assignment, reservation, or data-loading error persists, note the page and non-sensitive error text and contact your administrator. Do not send student data, passwords, access tokens, invitation links, or exported reports with a support request.
