import "./scss/index.scss";

import { isEmpty } from "lodash";
import React, { useEffect, useState } from "react";
import { RouteComponentProps } from "react-router";

import { useSearchQueryAttributes } from "@hooks";
import { useCart } from "@sdk/react";

import { MetaWrapper, NotFound, OfflinePlaceholder } from "../../components";
import NetworkStatus from "../../components/NetworkStatus";
import { getGraphqlIdFromDBId, maybe } from "../../core/utils";
import Page from "./Page";
import { TypedProductDetailsQuery } from "./queries";
import { IProps } from "./types";
import { ProductDetails_product } from "./types/ProductDetails";

const canDisplay = (product: ProductDetails_product) =>
  maybe(
    () =>
      !!product.descriptionJson &&
      !!product.name &&
      !!product.pricing &&
      !!product.variants
  );
const extractMeta = (product: ProductDetails_product) => ({
  custom: [
    {
      content: product.pricing.priceRange.start.gross.amount.toString(),
      property: "product:price:amount",
    },
    {
      content: product.pricing.priceRange.start.gross.currency,
      property: "product:price:currency",
    },
    {
      content: product.isAvailable ? "in stock" : "out off stock",
      property: "product:isAvailable",
    },
    {
      content: product.category.name,
      property: "product:category",
    },
  ],
  description: product.seoDescription || product.descriptionJson,
  image: maybe(() => product.thumbnail.url, null),
  title: product.seoTitle || product.name,
  type: "product.item",
  url: window.location.href,
});

const PageWithQueryAttributes: React.FC<IProps> = props => {
  const { product } = props;
  const { clearUrl, searchQueryAttributes } = useSearchQueryAttributes();
  const [queryAttributes, setQueryAttributes] = useState({});

  useEffect(() => {
    if (!isEmpty(searchQueryAttributes)) {
      let queryAttributes: Record<string, string> = {};
      product.variants.forEach(({ attributes }) => {
        attributes.forEach(({ attribute, values }) => {
          const attributeId = attribute.id;
          const selectedAttributeValue = searchQueryAttributes[attribute.slug];
          if (selectedAttributeValue) {
            values.forEach(({ value }) => {
              if (
                (value === selectedAttributeValue &&
                  isEmpty(queryAttributes)) ||
                attributes.some(
                  ({ attribute: { id }, values }) =>
                    queryAttributes[id] &&
                    queryAttributes[id] === values[0].value
                )
              ) {
                queryAttributes = {
                  ...queryAttributes,
                  [attributeId]: selectedAttributeValue,
                };
              }
            });
          }
        });
      });
      setQueryAttributes(queryAttributes);
    }
  }, [product.variants.length]);

  useEffect(() => {
    clearUrl();
  }, [queryAttributes]);

  return <Page {...props} queryAttributes={queryAttributes} />;
};

const View: React.FC<RouteComponentProps<{ id: string }>> = ({ match }) => {
  const { addItem, items } = useCart();

  return (
    <TypedProductDetailsQuery
      loaderFull
      variables={{
        id: getGraphqlIdFromDBId(match.params.id, "Product"),
      }}
      errorPolicy="all"
      key={match.params.id}
    >
      {({ data }) => (
        <NetworkStatus>
          {isOnline => {
            const { product } = data;
            if (canDisplay(product)) {
              return (
                <MetaWrapper meta={extractMeta(product)}>
                  <PageWithQueryAttributes
                    product={product}
                    add={addItem}
                    items={items}
                  />
                </MetaWrapper>
              );
            }

            if (product === null) {
              return <NotFound />;
            }

            if (!isOnline) {
              return <OfflinePlaceholder />;
            }
          }}
        </NetworkStatus>
      )}
    </TypedProductDetailsQuery>
  );
};

export default View;
