export interface SolicitudL {
  id: number;
  status: "pending" | "confirmed" | "canceled";
  start_date: string; 
  end_date: string;  
  total_mount: number; 
  cancelation_reason?: string | null;
  created_at: string;

  storeRooms: {
    id: number;
    title?: string;
    direction?: string;
    city?: string;
    size?: number;
    room_type?: string;
  };

  tenants: {
    id: number;
    user: {
      name: string;
      lastname: string;
      email: string;
      phone?: string;
    };
  };
}
