'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@ume/shared';
import { doc, setDoc, collection, addDoc } from 'firebase/firestore';
import Link from 'next/link';


interface AdminPanelProps {
  locale: string;
}

export default function AdminPanel({ locale }: AdminPanelProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p className="mb-4">Please log in to access the admin panel.</p>
          <Link href={`/${locale}/login`} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  const addDemoData = async () => {
    setLoading(true);
    setMessage('');

    try {
      // Step 1: Create couple profile
      console.log('Creating couple profile...');
      const coupleData = {
        id: user.uid,
        owners: [user.uid],
        profile: {
          names: {
            partner1: "Sarah",
            partner2: "Michael"
          },
          slug: "sarah-and-michael",
          locale: "en",
          currency: "USD",
          theme: {
            primaryColor: "#e91e63",
            secondaryColor: "#f8bbd9",
            accentColor: "#ff5722",
            backgroundColor: "#ffffff",
            textColor: "#333333",
            fontFamily: "Inter, sans-serif"
          },
          rsvpMode: "token",
          timezone: "America/Los_Angeles"
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await setDoc(doc(db, 'couples', user.uid), coupleData);
      console.log('✅ Couple profile created');

      // Step 2: Add sample guests
      console.log('Adding sample guests...');
      const guests = [
        {
          name: "John & Jane Smith",
          email: "john.smith@email.com",
          phone: "+1-555-0101",
          groupId: "smith-family",
          tags: ["family", "close-friends"],
          rsvp: {
            status: "accepted",
            events: {},
            dietaryRestrictions: "None",
            comments: "So excited for your special day!",
            submittedAt: new Date('2024-04-01T10:00:00'),
            plusOnes: []
          },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: "Michael Johnson",
          email: "m.johnson@email.com",
          phone: "+1-555-0102",
          groupId: "college-friends",
          tags: ["college-friends"],
          rsvp: {
            status: "pending",
            events: {},
            plusOnes: []
          },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: "Sarah Williams",
          email: "sarah.w@email.com",
          phone: "+1-555-0103",
          groupId: "work-colleagues",
          tags: ["work"],
          rsvp: {
            status: "declined",
            events: {},
            comments: "Unfortunately can't make it, but wishing you both the best!",
            submittedAt: new Date('2024-04-15T14:30:00'),
            plusOnes: []
          },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: "David & Emma Brown",
          email: "david.brown@email.com",
          phone: "+1-555-0104",
          groupId: "neighbors",
          tags: ["neighbors", "friends"],
          rsvp: {
            status: "accepted",
            events: {},
            dietaryRestrictions: "Emma is vegetarian",
            submittedAt: new Date('2024-04-10T16:45:00'),
            plusOnes: []
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      for (const guest of guests) {
        await addDoc(collection(db, 'couples', user.uid, 'guests'), guest);
      }
      console.log('✅ Sample guests added');

      // Step 3: Add wedding tasks
      console.log('Adding wedding tasks...');
      const tasks = [
        {
          title: "Book wedding photographer",
          description: "Find and book a professional wedding photographer",
          status: "completed",
          priority: "high",
          dueDate: new Date('2024-03-15T00:00:00'),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          title: "Choose wedding cake flavor",
          description: "Schedule cake tasting and choose final design",
          status: "in-progress",
          priority: "medium",
          dueDate: new Date('2024-05-15T00:00:00'),
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          title: "Plan rehearsal dinner",
          description: "Book venue and plan menu for rehearsal dinner",
          status: "not-started",
          priority: "medium",
          dueDate: new Date('2024-06-01T00:00:00'),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      for (const task of tasks) {
        await addDoc(collection(db, 'couples', user.uid, 'tasks'), task);
      }
      console.log('✅ Wedding tasks added');

      setMessage('✅ Demo data successfully added to Firebase! You can now view real data in the dashboard and guests pages.');
    } catch (error: any) {
      console.error('Error adding demo data:', error);
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Navigation */}
        <div className="mb-8">
          <Link href={`/${locale}`} className="text-blue-600 hover:text-blue-800">
            ← Back to Home
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Panel</h1>
          
          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              Logged in as: <strong>{user.email}</strong>
            </p>
            <p className="text-gray-600 mb-4">
              User ID: <code className="bg-gray-100 px-2 py-1 rounded">{user.uid}</code>
            </p>
          </div>

          <div className="border-t pt-6">
            <h2 className="text-xl font-semibold mb-4">Demo Data Setup</h2>
            <p className="text-gray-600 mb-6">
              Click the button below to add sample wedding data to Firebase. This will create:
            </p>
            <ul className="list-disc list-inside text-gray-600 mb-6 space-y-1">
              <li>A couple profile for Sarah & Michael</li>
              <li>Sample guest list with different RSVP statuses</li>
              <li>Wedding planning tasks</li>
            </ul>

            <button
              onClick={addDemoData}
              disabled={loading}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
            >
              {loading ? 'Adding Demo Data...' : 'Add Demo Data to Firebase'}
            </button>

            {message && (
              <div className={`mt-4 p-4 rounded-md ${
                message.includes('✅') 
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}>
                {message}
              </div>
            )}
          </div>

          <div className="border-t pt-6 mt-8">
            <h2 className="text-xl font-semibold mb-4">Quick Links</h2>
            <div className="flex gap-4">
              <Link href={`/${locale}/app/dashboard`} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                View Dashboard
              </Link>
              <Link href={`/${locale}/app/guests`} className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700">
                View Guests
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}