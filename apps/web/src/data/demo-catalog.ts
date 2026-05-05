import type { Category, ProductDetails } from "@lm-3d/shared";
import { assetPath } from "@/lib/assets";

export const categories: Category[] = [
  {
    id: "cat_decoracao",
    slug: "decoracao",
    name: "Decoracao",
    description: "Pecas para deixar ambientes mais criativos.",
    sortOrder: 1
  },
  {
    id: "cat_chaveiros",
    slug: "chaveiros",
    name: "Chaveiros",
    description: "Presentes simples, uteis e personalizaveis.",
    sortOrder: 2
  },
  {
    id: "cat_geek",
    slug: "geek",
    name: "Geek",
    description: "Itens tematicos para colecionar e presentear.",
    sortOrder: 3
  },
  {
    id: "cat_escritorio",
    slug: "escritorio",
    name: "Escritorio",
    description: "Organizadores e suportes para a rotina.",
    sortOrder: 4
  },
  {
    id: "cat_presentes",
    slug: "presentes",
    name: "Presentes",
    description: "Ideias com nome, cor ou detalhe especial.",
    sortOrder: 5
  },
  {
    id: "cat_funcionais",
    slug: "pecas-funcionais",
    name: "Pecas funcionais",
    description: "Solucoes sob medida para pequenos problemas.",
    sortOrder: 6
  }
];

export const products: ProductDetails[] = [
  {
    id: "prod_dragon",
    slug: "dragao-articulado",
    name: "Dragao articulado",
    shortDescription: "Peca flexivel para presente, mesa ou colecao.",
    description:
      "Um dragao articulado impresso com acabamento limpo, movimento suave e possibilidade de escolher cores conforme disponibilidade.",
    priceInCents: 8990,
    categorySlug: "geek",
    status: "active",
    acceptsCustomization: true,
    productionTime: "2 a 4 dias uteis",
    material: "PLA",
    dimensions: "Aprox. 28 cm de comprimento",
    weightInGrams: 120,
    colors: ["preto", "vermelho", "azul", "verde"],
    image: {
      src: assetPath("/images/product-dragon.svg"),
      alt: "Dragao articulado impresso em 3D",
      sortOrder: 1
    },
    images: [
      {
        src: assetPath("/images/product-dragon.svg"),
        alt: "Dragao articulado impresso em 3D",
        sortOrder: 1
      },
      {
        src: assetPath("/images/product-detail.svg"),
        alt: "Detalhe de acabamento de impressao 3D",
        sortOrder: 2
      }
    ],
    faq: [
      {
        question: "Da para escolher a cor?",
        answer: "Sim. Lucas confirma as cores disponiveis antes de iniciar a producao."
      },
      {
        question: "Serve para criancas pequenas?",
        answer: "E uma peca decorativa. Pecas pequenas exigem supervisao de um adulto."
      }
    ],
    relatedSlugs: ["suporte-controle", "chaveiro-nome"]
  },
  {
    id: "prod_keychain",
    slug: "chaveiro-nome",
    name: "Chaveiro com nome",
    shortDescription: "Personalize nome, cor e pequeno simbolo.",
    description:
      "Chaveiro leve e resistente para lembrancas, eventos, presentes e identificacao de chaves ou mochilas.",
    priceInCents: 2490,
    categorySlug: "chaveiros",
    status: "made_to_order",
    acceptsCustomization: true,
    productionTime: "1 a 3 dias uteis",
    material: "PLA",
    dimensions: "Aprox. 7 cm",
    weightInGrams: 24,
    colors: ["branco", "preto", "rosa", "azul", "amarelo"],
    image: {
      src: assetPath("/images/product-keychain.svg"),
      alt: "Chaveiro personalizado impresso em 3D",
      sortOrder: 1
    },
    images: [
      {
        src: assetPath("/images/product-keychain.svg"),
        alt: "Chaveiro personalizado impresso em 3D",
        sortOrder: 1
      }
    ],
    faq: [
      {
        question: "Posso pedir mais de uma unidade?",
        answer: "Sim. Quantidades maiores podem ter prazo e preco combinados."
      },
      {
        question: "O texto pode ser diferente do nome?",
        answer: "Pode. Frases curtas e iniciais funcionam melhor."
      }
    ],
    relatedSlugs: ["organizador-mesa", "dragao-articulado"]
  },
  {
    id: "prod_desk",
    slug: "organizador-mesa",
    name: "Organizador de mesa",
    shortDescription: "Espaco para canetas, clips e itens pequenos.",
    description:
      "Organizador de mesa para escritorio, setup gamer ou area de estudos, com visual limpo e boa estabilidade.",
    priceInCents: 6490,
    categorySlug: "escritorio",
    status: "active",
    acceptsCustomization: false,
    productionTime: "2 a 5 dias uteis",
    material: "PLA reforcado",
    dimensions: "16 x 9 x 8 cm",
    weightInGrams: 180,
    colors: ["preto", "cinza", "branco"],
    image: {
      src: assetPath("/images/product-desk.svg"),
      alt: "Organizador de mesa impresso em 3D",
      sortOrder: 1
    },
    images: [
      {
        src: assetPath("/images/product-desk.svg"),
        alt: "Organizador de mesa impresso em 3D",
        sortOrder: 1
      }
    ],
    faq: [
      {
        question: "A peca suporta objetos pesados?",
        answer: "Ela foi pensada para objetos leves de escritorio, como canetas e pequenos acessorios."
      }
    ],
    relatedSlugs: ["suporte-controle", "chaveiro-nome"]
  },
  {
    id: "prod_stand",
    slug: "suporte-controle",
    name: "Suporte para controle",
    shortDescription: "Base para controle, headset ou celular.",
    description:
      "Suporte funcional para organizar mesa, rack ou setup sem ocupar muito espaco.",
    priceInCents: 5490,
    categorySlug: "pecas-funcionais",
    status: "active",
    acceptsCustomization: true,
    productionTime: "2 a 4 dias uteis",
    material: "PLA",
    dimensions: "11 x 9 x 10 cm",
    weightInGrams: 95,
    colors: ["preto", "cinza", "azul"],
    image: {
      src: assetPath("/images/product-stand.svg"),
      alt: "Suporte para controle impresso em 3D",
      sortOrder: 1
    },
    images: [
      {
        src: assetPath("/images/product-stand.svg"),
        alt: "Suporte para controle impresso em 3D",
        sortOrder: 1
      }
    ],
    faq: [
      {
        question: "Serve para qualquer controle?",
        answer: "Serve para a maioria dos controles comuns. Medidas especificas podem ser confirmadas antes."
      }
    ],
    relatedSlugs: ["organizador-mesa", "dragao-articulado"]
  }
];

export const featuredProducts = products.slice(0, 3);

export function getCategoryBySlug(slug: string) {
  return categories.find((category) => category.slug === slug);
}

export function getProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getRelatedProducts(product: ProductDetails) {
  return product.relatedSlugs
    .map((slug) => getProductBySlug(slug))
    .filter((item): item is ProductDetails => Boolean(item));
}
