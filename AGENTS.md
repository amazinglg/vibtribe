# Project architecture rules

- Password recovery verifies the emailed code before revealing password fields; the code is consumed only when the password reset succeeds, preventing invalid-code password entry while retaining one-time use.