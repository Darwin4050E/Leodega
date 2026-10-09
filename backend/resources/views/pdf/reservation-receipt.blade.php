<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Comprobante {{ $receipt['code'] }}</title>
    <style>
        body { font-family: 'DejaVu Sans', sans-serif; font-size: 12px; color: #1f2937; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        .status { font-size: 12px; font-weight: bold; color: #166534; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #e5e7eb; }
        th { width: 40%; color: #6b7280; font-weight: normal; }
    </style>
</head>
<body>
    <h1>Comprobante de reserva</h1>
    <div class="status">{{ $receipt['status_label'] }}</div>
    <table>
        <tr><th>Número de reserva</th><td>{{ $receipt['code'] }}</td></tr>
        <tr><th>Bodega</th><td>{{ $receipt['store_room_title'] ?? '—' }}</td></tr>
        <tr><th>Gestor</th><td>{{ $receipt['gestor_name'] ?? '—' }}</td></tr>
        <tr><th>Fecha de inicio</th><td>{{ $receipt['start_date'] }}</td></tr>
        <tr><th>Fecha de fin</th><td>{{ $receipt['end_date'] }}</td></tr>
        <tr><th>Monto total pagado</th><td>${{ number_format((float) $receipt['total_paid'], 2) }} USD</td></tr>
        <tr><th>Fecha y hora de pago</th><td>{{ $receipt['paid_at_label'] }}</td></tr>
        @if ($receipt['payment_method_label'])
        <tr><th>Método de pago</th><td>{{ $receipt['payment_method_label'] }}</td></tr>
        @endif
        @if (! empty($receipt['organization_name']))
        <tr><th>Organización</th><td>Reservado a nombre de: {{ $receipt['organization_name'] }} (RUC {{ $receipt['organization_ruc'] }})</td></tr>
        @endif
        <tr><th>Estado</th><td>{{ $receipt['status_label'] }}</td></tr>
    </table>
</body>
</html>
