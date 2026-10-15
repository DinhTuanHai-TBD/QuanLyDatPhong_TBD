export interface IssueReport {
  id: number;
  roomId: number;
  roomName?: string;
  issueType: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical' | 'Normal' | 'Urgent' | string;
  description: string;
  imageUrl?: string;
  bookingId?: number;
  status: 'Pending' | 'Assigned' | 'Fixing' | 'InProgress' | 'Received' | 'Resolved' | 'Closed' | 'Rejected' | string;
  assignedTo?: string;
  repairNotes?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIssuePayload {
  roomId: number;
  issueType: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical' | 'Normal' | 'Urgent' | string;
  description: string;
  imageUrl?: string;
  bookingId?: number;
}
