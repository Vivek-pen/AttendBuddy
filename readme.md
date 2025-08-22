📚 Full-Stack Attendance Calculator
Manually tracking university or school attendance can be a tedious and error-prone task. Forgetting to log a single class can lead to inaccurate percentages, causing unnecessary stress around meeting academic requirements. This Full-Stack Attendance Calculator was developed to solve this problem by providing a reliable, user-friendly, and centralized platform for students to manage their attendance effortlessly.

This project is built with a clean interface using vanilla HTML, CSS, and JavaScript for a lightweight frontend experience. It is powered by a robust Firebase backend, ensuring that all user data is stored securely and synchronized in real-time.

✨ Features
Secure User Authentication: Leveraging Firebase Authentication, the application provides a secure login and registration system. After a simple sign-up process, all timetable and attendance information is linked exclusively to the user's private account, preventing unauthorized access.

Flexible Timetable Management: The core of the application is its dynamic timetable setup. Users can define their entire weekly schedule, specifying the number of periods for each day and assigning subject names. This timetable is not static; it can be easily modified at any point from the 'Edit Timetable' section to reflect changes in the academic schedule.

Intuitive Daily Marking: The attendance view presents a clean, daily schedule, allowing users to mark each period as "Present" or "Absent" with a single click. Navigation controls make it simple to move to previous or future dates to either review or correct past entries.

Data Integrity: To ensure accuracy, the app includes features like attendance locking, which prevents accidental changes after a day's record is finalized. Furthermore, users can mark any day as a holiday, correctly excluding it from all statistical calculations.

Actionable Statistics: The powerful analytics dashboard provides immediate insights. It visualizes the overall attendance percentage and offers a detailed, subject-by-subject breakdown with color-coded indicators, allowing students to quickly identify which subjects require more attention.

💻 Tech Stack
Frontend: Built with vanilla HTML5, CSS3, and JavaScript (ES6 Modules) to ensure a fast, lightweight, and dependency-free user experience.

Backend: Powered by Google Firebase, chosen for its robust, real-time capabilities and scalability.

Firebase Authentication: Handles secure, email-based user management.

Firestore: Serves as the real-time NoSQL database, ensuring all data is instantly synced and persisted across sessions.

Deployment: The application is a static web app ready for seamless deployment on services like Netlify, Vercel, or Firebase Hosting.