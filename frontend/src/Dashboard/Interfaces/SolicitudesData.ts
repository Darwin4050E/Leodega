
export interface Cliente {
    nombre: string;
    estado: string;
    avatar: string;
    email: string;
    telefono: string;
}

export interface DetallesReserva {
    bodega: string;
    ubicacion: string;
    area: string;
    duracion: string;
    inicio: string;
    fin: string;
}

export interface InformacionFinanciera {
    arriendoMensual: string;
    deposito: string;
    totalEstimado: string;
}

export interface SolicitudDetallada {
    id: number;
    titulo: string;
    tiempo: string;
    estado: string;
    cliente: Cliente;
    detallesReserva: DetallesReserva;
    informacionFinanciera: InformacionFinanciera;
}


export interface Solicitud {
    id: number;
    nombre: string;
    email?: string;
    direccion: string;
    fecha: string;
    tipo: string;
    estado: 'Completada' | 'En proceso' | 'Rechazada' | 'En espera';
}

export interface ReporteDetalle {
  id: number;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  report_type: string;
  status: string;
  cancelation_reason?: string | null;
  created_at: string;

  user: {
    name: string;
    email: string;
  };

  store: {
    direction: string;
  };

  evidences: {
    id: number;
    file_path: string;
    file_type: string;
  }[];
}


export interface Bodega {
    id: number;
    nameBodega: string;
    bodega: number;
    phoneNumber: string;
    email: string;
    country: string;
    status: 'Active' | 'Inactive';
}
