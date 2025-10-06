import { db } from '@ume/shared';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  query, 
  where,
  writeBatch,
  runTransaction 
} from 'firebase/firestore';

export interface Guest {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  groupId?: string;
  categories?: string[];
  events?: string[];
  tableAssignment?: string;
  rsvp?: {
    status: 'accepted' | 'declined' | 'pending' | 'Confirmé' | 'Refusé' | 'En attente';
    submittedAt?: any;
    partySize?: number;
    comments?: string;
    dietaryRestrictions?: string;
    updatedAt?: any;
  };
}

export interface Table {
  id: string;
  name: string;
  capacity: number;
  guests: Guest[];
  x: number;
  y: number;
  shape: 'round' | 'rectangle' | 'square';
  eventId?: string;
  width?: number;
  height?: number;
  radius?: number;
  size?: number;
}

export interface SeatingArrangement {
  eventId: string;
  eventName: string;
  tables: Table[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RSVPChange {
  guestId: string;
  oldStatus?: string;
  newStatus: string;
  partySize?: number;
  eventNames?: string[];
}

/**
 * Service for synchronizing RSVP responses with seating arrangements
 */
export class RSVPSeatingService {
  private coupleId: string;

  constructor(coupleId: string) {
    this.coupleId = coupleId;
  }

  /**
   * Handle RSVP status change and update seating accordingly
   */
  async handleRSVPChange(change: RSVPChange): Promise<void> {
    const { guestId, oldStatus, newStatus, partySize, eventNames } = change;

    try {
      // Get guest details
      const guestDoc = await getDoc(doc(db, 'couples', this.coupleId, 'guests', guestId));
      if (!guestDoc.exists()) {
        console.warn(`Guest ${guestId} not found`);
        return;
      }

      const guest = { id: guestDoc.id, ...guestDoc.data() } as Guest;
      const guestEvents = eventNames || guest.events || [];

      // Handle different RSVP status changes
      if (this.isAccepted(newStatus) && !this.isAccepted(oldStatus)) {
        // Guest accepted - suggest seating
        await this.handleAcceptedRSVP(guest, guestEvents, partySize);
      } else if (this.isDeclined(newStatus) && !this.isDeclined(oldStatus)) {
        // Guest declined - remove from seating
        await this.handleDeclinedRSVP(guest, guestEvents);
      } else if (this.isAccepted(oldStatus) && this.isDeclined(newStatus)) {
        // Changed from accepted to declined - remove from seating
        await this.handleDeclinedRSVP(guest, guestEvents);
      }

      console.log(`RSVP-Seating sync completed for guest ${guestId}: ${oldStatus} -> ${newStatus}`);
    } catch (error) {
      console.error('Error handling RSVP change:', error);
      throw error;
    }
  }

  /**
   * Handle guest acceptance - suggest seating placement
   */
  private async handleAcceptedRSVP(guest: Guest, eventNames: string[], partySize?: number): Promise<void> {
    for (const eventName of eventNames) {
      try {
        // Get seating arrangement for this event
        const seatingDoc = await getDoc(doc(db, 'couples', this.coupleId, 'seating', eventName));
        
        if (seatingDoc.exists()) {
          const seatingData = seatingDoc.data() as SeatingArrangement;
          
          // Find suitable table for guest
          const suitableTable = this.findSuitableTable(guest, seatingData.tables, partySize);
          
          if (suitableTable) {
            // Assign guest to table
            await this.assignGuestToTable(guest.id, suitableTable.id, eventName);
            console.log(`Assigned guest ${guest.id} to table ${suitableTable.name} for event ${eventName}`);
          } else {
            // Log that no suitable table was found - manual assignment needed
            console.log(`No suitable table found for guest ${guest.id} in event ${eventName} - manual assignment required`);
          }
        } else {
          console.log(`No seating arrangement exists for event ${eventName}`);
        }
      } catch (error) {
        console.error(`Error handling accepted RSVP for event ${eventName}:`, error);
      }
    }
  }

  /**
   * Handle guest decline - remove from all seating arrangements
   */
  private async handleDeclinedRSVP(guest: Guest, eventNames: string[]): Promise<void> {
    for (const eventName of eventNames) {
      try {
        await this.removeGuestFromSeating(guest.id, eventName);
        console.log(`Removed guest ${guest.id} from seating for event ${eventName}`);
      } catch (error) {
        console.error(`Error removing guest from seating for event ${eventName}:`, error);
      }
    }
  }

  /**
   * Find a suitable table for a guest based on their profile and party size
   */
  private findSuitableTable(guest: Guest, tables: Table[], partySize?: number): Table | null {
    const requiredCapacity = partySize || 1;
    
    // Filter tables with available capacity
    const availableTables = tables.filter(table => {
      const currentOccupancy = table.guests?.length || 0;
      return (table.capacity - currentOccupancy) >= requiredCapacity;
    });

    if (availableTables.length === 0) {
      return null;
    }

    // Prioritize tables with guests from same group/category
    if (guest.groupId || guest.categories?.length) {
      const matchingTable = availableTables.find(table => {
        return table.guests?.some(tableGuest => {
          // Match by group
          if (guest.groupId && tableGuest.groupId === guest.groupId) {
            return true;
          }
          // Match by categories
          if (guest.categories && tableGuest.categories) {
            return guest.categories.some(cat => tableGuest.categories?.includes(cat));
          }
          return false;
        });
      });

      if (matchingTable) {
        return matchingTable;
      }
    }

    // Fallback: find table with most available space
    return availableTables.reduce((best, current) => {
      const bestAvailable = best.capacity - (best.guests?.length || 0);
      const currentAvailable = current.capacity - (current.guests?.length || 0);
      return currentAvailable > bestAvailable ? current : best;
    });
  }

  /**
   * Assign guest to a specific table
   */
  async assignGuestToTable(guestId: string, tableId: string, eventName: string): Promise<void> {
    await runTransaction(db, async (transaction) => {
      // Update guest document with table assignment
      const guestRef = doc(db, 'couples', this.coupleId, 'guests', guestId);
      const guestDoc = await transaction.get(guestRef);
      
      if (!guestDoc.exists()) {
        throw new Error(`Guest ${guestId} not found`);
      }

      // Update guest's table assignment
      transaction.update(guestRef, { 
        tableAssignment: `${eventName}:${tableId}` 
      });

      // Update seating arrangement
      const seatingRef = doc(db, 'couples', this.coupleId, 'seating', eventName);
      const seatingDoc = await transaction.get(seatingRef);
      
      if (seatingDoc.exists()) {
        const seatingData = seatingDoc.data() as SeatingArrangement;
        const updatedTables = seatingData.tables.map(table => {
          if (table.id === tableId) {
            const guest = { id: guestId, ...guestDoc.data() } as Guest;
            return {
              ...table,
              guests: [...(table.guests || []), guest]
            };
          }
          return table;
        });

        transaction.update(seatingRef, {
          tables: updatedTables,
          updatedAt: new Date()
        });
      }
    });
  }

  /**
   * Remove guest from seating arrangements
   */
  async removeGuestFromSeating(guestId: string, eventName?: string): Promise<void> {
    if (eventName) {
      // Remove from specific event
      await this.removeGuestFromEvent(guestId, eventName);
    } else {
      // Remove from all events
      const allEvents = await this.getAllEvents();
      for (const event of allEvents) {
        await this.removeGuestFromEvent(guestId, event.name);
      }
    }

    // Clear guest's table assignment
    const guestRef = doc(db, 'couples', this.coupleId, 'guests', guestId);
    await updateDoc(guestRef, { 
      tableAssignment: null 
    });
  }

  /**
   * Remove guest from a specific event's seating
   */
  private async removeGuestFromEvent(guestId: string, eventName: string): Promise<void> {
    const seatingRef = doc(db, 'couples', this.coupleId, 'seating', eventName);
    const seatingDoc = await getDoc(seatingRef);
    
    if (seatingDoc.exists()) {
      const seatingData = seatingDoc.data() as SeatingArrangement;
      const updatedTables = seatingData.tables.map(table => ({
        ...table,
        guests: (table.guests || []).filter(guest => guest.id !== guestId)
      }));

      await updateDoc(seatingRef, {
        tables: updatedTables,
        updatedAt: new Date()
      });
    }
  }

  /**
   * Get seating statistics for dashboard
   */
  async getSeatingStats(): Promise<{
    totalSeats: number;
    assignedSeats: number;
    availableSeats: number;
    completionRate: number;
  }> {
    try {
      const seatingQuery = query(collection(db, 'couples', this.coupleId, 'seating'));
      const seatingSnapshot = await getDocs(seatingQuery);
      
      let totalSeats = 0;
      let assignedSeats = 0;
      
      seatingSnapshot.forEach((doc) => {
        const seatingData = doc.data() as SeatingArrangement;
        seatingData.tables.forEach(table => {
          totalSeats += table.capacity;
          assignedSeats += table.guests?.length || 0;
        });
      });
      
      const availableSeats = totalSeats - assignedSeats;
      const completionRate = totalSeats > 0 ? Math.round((assignedSeats / totalSeats) * 100) : 0;
      
      return {
        totalSeats,
        assignedSeats,
        availableSeats,
        completionRate
      };
    } catch (error) {
      console.error('Error fetching seating stats:', error);
      return {
        totalSeats: 0,
        assignedSeats: 0,
        availableSeats: 0,
        completionRate: 0
      };
    }
  }

  /**
   * Get all events from couple document
   */
  private async getAllEvents(): Promise<{id: string, name: string}[]> {
    try {
      const coupleDoc = await getDoc(doc(db, 'couples', this.coupleId));
      if (!coupleDoc.exists()) return [];
      
      const coupleData = coupleDoc.data();
      const events = coupleData.events || [];
      
      return events.map((event: any) => ({
        id: event.id || event.name,
        name: event.name
      }));
    } catch (error) {
      console.error('Error fetching events:', error);
      return [];
    }
  }

  /**
   * Bulk process RSVP changes (useful for initial setup or bulk imports)
   */
  async processBulkRSVPChanges(changes: RSVPChange[]): Promise<void> {
    const batch = writeBatch(db);
    
    for (const change of changes) {
      await this.handleRSVPChange(change);
    }
    
    console.log(`Processed ${changes.length} RSVP changes`);
  }

  /**
   * Check if RSVP status is accepted
   */
  private isAccepted(status?: string): boolean {
    return status === 'accepted' || status === 'Confirmé';
  }

  /**
   * Check if RSVP status is declined
   */
  private isDeclined(status?: string): boolean {
    return status === 'declined' || status === 'Refusé';
  }

  /**
   * Validate seating assignments against current RSVPs
   */
  async validateSeatingAssignments(): Promise<{
    valid: boolean;
    issues: string[];
    conflictingAssignments: { guestId: string; issue: string }[];
  }> {
    const issues: string[] = [];
    const conflictingAssignments: { guestId: string; issue: string }[] = [];
    
    try {
      // Get all guests
      const guestsQuery = query(collection(db, 'couples', this.coupleId, 'guests'));
      const guestsSnapshot = await getDocs(guestsQuery);
      
      guestsSnapshot.forEach((doc) => {
        const guest = { id: doc.id, ...doc.data() } as Guest;
        
        // Check if declined guests are still assigned to tables
        if (this.isDeclined(guest.rsvp?.status) && guest.tableAssignment) {
          const issue = `Declined guest ${guest.id} is still assigned to table`;
          issues.push(issue);
          conflictingAssignments.push({ guestId: guest.id, issue });
        }
        
        // Check if accepted guests without table assignment
        if (this.isAccepted(guest.rsvp?.status) && !guest.tableAssignment) {
          const issue = `Accepted guest ${guest.id} has no table assignment`;
          issues.push(issue);
          conflictingAssignments.push({ guestId: guest.id, issue });
        }
      });
    } catch (error) {
      console.error('Error validating seating assignments:', error);
      issues.push('Error occurred during validation');
    }
    
    return {
      valid: issues.length === 0,
      issues,
      conflictingAssignments
    };
  }

  /**
   * Clean up seating assignments for declined guests
   */
  async cleanupDeclinedGuestSeating(): Promise<void> {
    const validation = await this.validateSeatingAssignments();
    
    for (const conflict of validation.conflictingAssignments) {
      if (conflict.issue.includes('Declined guest') && conflict.issue.includes('assigned to table')) {
        await this.removeGuestFromSeating(conflict.guestId);
        console.log(`Removed declined guest ${conflict.guestId} from seating`);
      }
    }
  }
}

// Factory function
export function createRSVPSeatingService(coupleId: string): RSVPSeatingService {
  return new RSVPSeatingService(coupleId);
}

// Convenience function for handling RSVP changes
export async function syncRSVPChange(
  coupleId: string, 
  change: RSVPChange
): Promise<void> {
  const service = new RSVPSeatingService(coupleId);
  await service.handleRSVPChange(change);
}