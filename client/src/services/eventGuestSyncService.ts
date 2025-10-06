import { db } from '@ume/shared';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  query, 
  writeBatch,
  runTransaction 
} from 'firebase/firestore';

export interface EventChange {
  type: 'create' | 'update' | 'delete';
  eventId: string;
  oldEventName?: string;
  newEventName?: string;
  eventData?: any;
}

export interface GuestEventAssignment {
  guestId: string;
  events: string[];
}

/**
 * Centralized service for maintaining sync between events and guest assignments
 */
export class EventGuestSyncService {
  private coupleId: string;

  constructor(coupleId: string) {
    this.coupleId = coupleId;
  }

  /**
   * Get all guests with their event assignments
   */
  async getAllGuestEventAssignments(): Promise<GuestEventAssignment[]> {
    try {
      const guestsQuery = query(collection(db, 'couples', this.coupleId, 'guests'));
      const guestsSnapshot = await getDocs(guestsQuery);
      
      const assignments: GuestEventAssignment[] = [];
      guestsSnapshot.forEach((doc) => {
        const guestData = doc.data();
        assignments.push({
          guestId: doc.id,
          events: guestData.events || []
        });
      });
      
      return assignments;
    } catch (error) {
      console.error('Error fetching guest event assignments:', error);
      throw error;
    }
  }

  /**
   * Get all current events from the couple document
   */
  async getCurrentEvents(): Promise<{id: string, name: string}[]> {
    try {
      const coupleDoc = await getDoc(doc(db, 'couples', this.coupleId));
      if (!coupleDoc.exists()) return [];
      
      const coupleData = coupleDoc.data();
      const events = coupleData.events || [];
      
      return events.map((event: any) => ({
        id: event.id,
        name: event.name
      }));
    } catch (error) {
      console.error('Error fetching current events:', error);
      throw error;
    }
  }

  /**
   * Validate guest event assignments against current events
   */
  async validateGuestEventAssignments(): Promise<{
    valid: boolean;
    issues: string[];
    orphanedAssignments: { guestId: string; orphanedEvents: string[] }[];
  }> {
    const currentEvents = await this.getCurrentEvents();
    const guestAssignments = await this.getAllGuestEventAssignments();
    
    const validEventNames = new Set(currentEvents.map(e => e.name));
    const issues: string[] = [];
    const orphanedAssignments: { guestId: string; orphanedEvents: string[] }[] = [];
    
    guestAssignments.forEach(assignment => {
      const orphanedEvents = assignment.events.filter(eventName => !validEventNames.has(eventName));
      if (orphanedEvents.length > 0) {
        orphanedAssignments.push({
          guestId: assignment.guestId,
          orphanedEvents
        });
        issues.push(`Guest ${assignment.guestId} assigned to non-existent events: ${orphanedEvents.join(', ')}`);
      }
    });
    
    return {
      valid: issues.length === 0,
      issues,
      orphanedAssignments
    };
  }

  /**
   * Clean up orphaned event assignments
   */
  async cleanupOrphanedAssignments(): Promise<void> {
    const validation = await this.validateGuestEventAssignments();
    
    if (validation.orphanedAssignments.length === 0) {
      console.log('No orphaned assignments to clean up');
      return;
    }
    
    const batch = writeBatch(db);
    
    validation.orphanedAssignments.forEach(({ guestId, orphanedEvents }) => {
      // Get current guest events and remove orphaned ones
      const guestRef = doc(db, 'couples', this.coupleId, 'guests', guestId);
      // This will be updated in the actual implementation
    });
    
    // Use transaction for safe cleanup
    await runTransaction(db, async (transaction) => {
      for (const { guestId, orphanedEvents } of validation.orphanedAssignments) {
        const guestRef = doc(db, 'couples', this.coupleId, 'guests', guestId);
        const guestDoc = await transaction.get(guestRef);
        
        if (guestDoc.exists()) {
          const currentEvents = guestDoc.data().events || [];
          const cleanedEvents = currentEvents.filter((eventName: string) => 
            !orphanedEvents.includes(eventName)
          );
          
          transaction.update(guestRef, { events: cleanedEvents });
        }
      }
    });
    
    console.log(`Cleaned up ${validation.orphanedAssignments.length} guest assignments`);
  }

  /**
   * Handle event creation - no guest updates needed initially
   */
  async handleEventCreated(eventId: string, eventName: string): Promise<void> {
    console.log(`Event created: ${eventName} (${eventId})`);
    // New events don't need immediate guest updates
    // Guests can be assigned to this event later
  }

  /**
   * Handle event name update - update all guest assignments
   */
  async handleEventRenamed(eventId: string, oldName: string, newName: string): Promise<void> {
    console.log(`Renaming event from "${oldName}" to "${newName}"`);
    
    await runTransaction(db, async (transaction) => {
      // Get all guests
      const guestsQuery = query(collection(db, 'couples', this.coupleId, 'guests'));
      const guestsSnapshot = await getDocs(guestsQuery);
      
      const updates: { guestId: string; newEvents: string[] }[] = [];
      
      guestsSnapshot.forEach((doc) => {
        const guestData = doc.data();
        const currentEvents = guestData.events || [];
        
        if (currentEvents.includes(oldName)) {
          const updatedEvents = currentEvents.map((eventName: string) => 
            eventName === oldName ? newName : eventName
          );
          updates.push({
            guestId: doc.id,
            newEvents: updatedEvents
          });
        }
      });
      
      // Apply all updates in the transaction
      updates.forEach(({ guestId, newEvents }) => {
        const guestRef = doc(db, 'couples', this.coupleId, 'guests', guestId);
        transaction.update(guestRef, { events: newEvents });
      });
    });
    
    console.log(`Updated ${(await this.getAffectedGuestsCount(oldName))} guest assignments`);
  }

  /**
   * Handle event deletion - remove from all guest assignments
   */
  async handleEventDeleted(eventId: string, eventName: string): Promise<void> {
    console.log(`Deleting event: ${eventName} (${eventId})`);
    
    await runTransaction(db, async (transaction) => {
      // Get all guests
      const guestsQuery = query(collection(db, 'couples', this.coupleId, 'guests'));
      const guestsSnapshot = await getDocs(guestsQuery);
      
      const updates: { guestId: string; newEvents: string[] }[] = [];
      
      guestsSnapshot.forEach((doc) => {
        const guestData = doc.data();
        const currentEvents = guestData.events || [];
        
        if (currentEvents.includes(eventName)) {
          const updatedEvents = currentEvents.filter((name: string) => name !== eventName);
          updates.push({
            guestId: doc.id,
            newEvents: updatedEvents
          });
        }
      });
      
      // Apply all updates in the transaction
      updates.forEach(({ guestId, newEvents }) => {
        const guestRef = doc(db, 'couples', this.coupleId, 'guests', guestId);
        transaction.update(guestRef, { events: newEvents });
      });
    });
    
    console.log(`Removed event from ${(await this.getAffectedGuestsCount(eventName))} guest assignments`);
  }

  /**
   * Get count of guests assigned to a specific event
   */
  private async getAffectedGuestsCount(eventName: string): Promise<number> {
    const guestsQuery = query(collection(db, 'couples', this.coupleId, 'guests'));
    const guestsSnapshot = await getDocs(guestsQuery);
    
    let count = 0;
    guestsSnapshot.forEach((doc) => {
      const guestData = doc.data();
      const currentEvents = guestData.events || [];
      if (currentEvents.includes(eventName)) {
        count++;
      }
    });
    
    return count;
  }

  /**
   * Bulk assign guests to an event
   */
  async assignGuestsToEvent(guestIds: string[], eventName: string): Promise<void> {
    const batch = writeBatch(db);
    
    for (const guestId of guestIds) {
      const guestRef = doc(db, 'couples', this.coupleId, 'guests', guestId);
      const guestDoc = await getDoc(guestRef);
      
      if (guestDoc.exists()) {
        const currentEvents = guestDoc.data().events || [];
        if (!currentEvents.includes(eventName)) {
          const updatedEvents = [...currentEvents, eventName];
          batch.update(guestRef, { events: updatedEvents });
        }
      }
    }
    
    await batch.commit();
    console.log(`Assigned ${guestIds.length} guests to event: ${eventName}`);
  }

  /**
   * Bulk remove guests from an event
   */
  async removeGuestsFromEvent(guestIds: string[], eventName: string): Promise<void> {
    const batch = writeBatch(db);
    
    for (const guestId of guestIds) {
      const guestRef = doc(db, 'couples', this.coupleId, 'guests', guestId);
      const guestDoc = await getDoc(guestRef);
      
      if (guestDoc.exists()) {
        const currentEvents = guestDoc.data().events || [];
        const updatedEvents = currentEvents.filter((name: string) => name !== eventName);
        batch.update(guestRef, { events: updatedEvents });
      }
    }
    
    await batch.commit();
    console.log(`Removed ${guestIds.length} guests from event: ${eventName}`);
  }

  /**
   * Get guests assigned to a specific event
   */
  async getGuestsAssignedToEvent(eventName: string): Promise<{id: string, name: string}[]> {
    const guestsQuery = query(collection(db, 'couples', this.coupleId, 'guests'));
    const guestsSnapshot = await getDocs(guestsQuery);
    
    const assignedGuests: {id: string, name: string}[] = [];
    
    guestsSnapshot.forEach((doc) => {
      const guestData = doc.data();
      const currentEvents = guestData.events || [];
      
      if (currentEvents.includes(eventName)) {
        assignedGuests.push({
          id: doc.id,
          name: guestData.firstName && guestData.lastName 
            ? `${guestData.firstName} ${guestData.lastName}`
            : guestData.name || 'Unknown Guest'
        });
      }
    });
    
    return assignedGuests;
  }

  /**
   * Get event assignment statistics
   */
  async getEventAssignmentStats(): Promise<{
    totalEvents: number;
    totalGuests: number;
    avgGuestsPerEvent: number;
    eventsWithNoGuests: string[];
    guestsWithNoEvents: string[];
  }> {
    const [currentEvents, guestAssignments] = await Promise.all([
      this.getCurrentEvents(),
      this.getAllGuestEventAssignments()
    ]);
    
    // Calculate assignments per event
    const eventGuestCounts: Record<string, number> = {};
    currentEvents.forEach(event => {
      eventGuestCounts[event.name] = 0;
    });
    
    guestAssignments.forEach(assignment => {
      assignment.events.forEach(eventName => {
        if (eventGuestCounts[eventName] !== undefined) {
          eventGuestCounts[eventName]++;
        }
      });
    });
    
    const eventsWithNoGuests = Object.entries(eventGuestCounts)
      .filter(([_, count]) => count === 0)
      .map(([eventName, _]) => eventName);
    
    const guestsWithNoEvents = guestAssignments
      .filter(assignment => assignment.events.length === 0)
      .map(assignment => assignment.guestId);
    
    const totalAssignments = Object.values(eventGuestCounts).reduce((sum, count) => sum + count, 0);
    const avgGuestsPerEvent = currentEvents.length > 0 ? totalAssignments / currentEvents.length : 0;
    
    return {
      totalEvents: currentEvents.length,
      totalGuests: guestAssignments.length,
      avgGuestsPerEvent: Math.round(avgGuestsPerEvent * 100) / 100,
      eventsWithNoGuests,
      guestsWithNoEvents
    };
  }
}

// Helper function to get current events (used by validation)
async function getCurrentEvents(): Promise<{id: string, name: string}[]> {
  // Implementation moved to class method
  return [];
}

// Factory function to create service instance
export function createEventGuestSyncService(coupleId: string): EventGuestSyncService {
  return new EventGuestSyncService(coupleId);
}

// Convenience functions for common operations
export async function syncEventChange(
  coupleId: string, 
  change: EventChange
): Promise<void> {
  const syncService = new EventGuestSyncService(coupleId);
  
  switch (change.type) {
    case 'create':
      await syncService.handleEventCreated(change.eventId, change.newEventName!);
      break;
    case 'update':
      if (change.oldEventName && change.newEventName) {
        await syncService.handleEventRenamed(change.eventId, change.oldEventName, change.newEventName);
      }
      break;
    case 'delete':
      await syncService.handleEventDeleted(change.eventId, change.oldEventName!);
      break;
  }
}

export async function validateAndCleanupEventAssignments(coupleId: string): Promise<void> {
  const syncService = new EventGuestSyncService(coupleId);
  await syncService.cleanupOrphanedAssignments();
}