# Firebase Configuration

## Project Setup

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase project
firebase init
```

## Firebase Project Configuration

### Environment Variables (.env.local)

```
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Firebase Services Used

- **Authentication**: User management for couples and admins
- **Firestore**: NoSQL database for wedding data
- **Storage**: File storage for images, documents, exports
- **Cloud Functions**: Server-side logic for RSVP, exports, notifications
- **Hosting**: Deploy client and admin apps (using Vercel instead)

### Security Rules Structure

- Multi-tenant isolation (couples/{coupleId}/...)
- Admin role-based access
- RSVP token validation
- Secure file access per couple