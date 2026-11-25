export interface BlogPost {
  id: string;
  slug: string;
  category: string;
  readingTime: string;
  publishedAt: string;
  title: string;
  excerpt: string;
  paragraphs: string[];
  keyTakeaway: string;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    id: 'blog-punto-equilibrio-sin-excel',
    slug: 'como-calcular-punto-de-equilibrio-sin-excel',
    category: 'Cimientos',
    readingTime: '3 min de lectura',
    publishedAt: '2026-11-10',
    title: '¿Cómo calcular tu punto de equilibrio paso a paso sin pelearte con Excel?',
    excerpt:
      'Aprende a juntar tus gastos fijos, lo que cuesta cada venta y tu precio para saber desde qué venta empiezas a ganar dinero de verdad.',
    paragraphs: [
      'Muchas veces vendes toda la semana y aun así llegas a fin de mes con dudas sobre si realmente ganaste plata o solo cambiaste plata de bolsillo. El punto de equilibrio sirve justamente para quitarte esa incertidumbre.',
      'Solo necesitas tres números reales: tus costos fijos del mes (arriendo, luz, internet, software y tu sueldo base si lo consideras), el costo variable de cada unidad vendida (insumos, envase, comisión de tarjeta y envío) y el precio al que vendes.',
      'Al restar el costo variable del precio obtienes tu margen de contribución: es lo que cada venta deja libre para pagar tus gastos fijos. Si divides tus costos fijos totales por ese margen por unidad, sabrás exactamente cuántas unidades necesitas vender para quedar en cero y empezar a ganar desde la siguiente.',
    ],
    keyTakeaway:
      'No necesitas fórmulas complejas ni planillas frágiles: con esos 3 datos claros puedes probar precios, medir metas y decidir con calma.',
  },
  {
    id: 'blog-vendo-harto-pero-no-veo-plata',
    slug: 'vendo-harto-pero-no-veo-plata-fin-de-mes',
    category: 'Caja y márgenes',
    readingTime: '4 min de lectura',
    publishedAt: '2026-11-15',
    title: '“Vendo harto, pero no veo la plata a fin de mes”: 3 fugas silenciosas en pymes',
    excerpt:
      'Cuando las ventas suben pero la cuenta corriente no acompaña, el problema casi siempre está en alguno de estos tres puntos.',
    paragraphs: [
      '1. Productos estrella que dejan poco margen: a veces el producto que más pide la gente tiene comisiones de despacho, empaques caros o mucho tiempo personal detrás. Si vendes harto de algo con margen bajito, trabajas el doble para cubrir el taller.',
      '2. Ventas fiadas o por cobrar que parecen ingreso disponible: anotar una venta en el cuaderno no es lo mismo que tener la plata en el banco. Si cobras a 30 o 60 días pero pagas insumos al contado, tu caja se aprieta aunque el mes se vea “positivo”.',
      '3. Olvidar el sueldo de quien emprende: si no incluyes tu propio sueldo como gasto fijo del negocio, la utilidad del mes puede verse más alta de lo que realmente es.',
    ],
    keyTakeaway:
      'Ordenar tus márgenes por producto y separar ventas cobradas de cuentas por cobrar devuelve la tranquilidad a tu caja.',
  },
  {
    id: 'blog-iva-neto-o-incluido-chile',
    slug: 'precio-con-iva-vs-neto-pymes-chile',
    category: 'Realidad chilena',
    readingTime: '3 min de lectura',
    publishedAt: '2026-11-20',
    title: 'Precio con IVA vs precio neto en Chile: cómo no comerte tu ganancia al boletear',
    excerpt:
      'Una guía en palabras simples para entender por qué el 19% de IVA no es ganancia tuya y cómo estimar tu F29 sin sustos.',
    paragraphs: [
      'Un error muy común al empezar es calcular el precio diciendo “me cuesta $5.000, lo vendo a $10.000 y me gano $5.000”. Si emites boleta o factura afecta a IVA (19%), una parte de esos $10.000 no es tuya: corresponde al IVA que luego debes declarar en el F29.',
      'Con $10.000 IVA incluido, tu ingreso neto real es cerca de $8.403 ($10.000 dividido en 1,19), y los otros $1.597 son IVA débito. A ese monto le restas el IVA crédito de tus compras con factura para estimar cuánto pagarás.',
      'Tener una estimación referencial mes a mes te permite apartar esa plata con tiempo, aunque siempre recuerda validar tu declaración oficial F29 con tu contador.',
    ],
    keyTakeaway:
      'Calcula siempre tu margen sobre el valor neto real y aparta el IVA cobrado para que el día del F29 no te tome por sorpresa.',
  },
];
