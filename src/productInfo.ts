import { Product } from "./types";

const basePath =
  import.meta.env.MODE === "production" ? "/digital-store" : "./src";

const PRODUCT: Product = {
  id: 1,
  title: "Complete Web Development Bundle",
  description:
    "Learn to build websites with HTML, CSS, Javascript, React, Node, and Mongo",
  image: `${basePath}/assets/thumbnail.png`,
  price: 12.99,
};
export default PRODUCT;
