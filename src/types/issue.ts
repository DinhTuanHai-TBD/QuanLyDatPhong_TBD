export interface IssueReport {
  id: number;
  roomId: number;
  roomName?: string;
  issueType: string;
  priority: 'Normal' | 'Urgent';
  description: string;
  imageUrl?: string;
  bookingId?: number;
  status: 'Pending' | 'Received' | 'InProgress' | 'Resolved' | 'Closed';
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateIssuePayload {
  roomId: number;
  issueType: string;
  priority: 'Normal' | 'Urgent';
  description: string;
  imageUrl?: string;
  bookingId?: number;
}
