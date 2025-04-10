import { MorphoGraphQLClient } from '../graphql-client';

const MORPHO_GRAPHQL_ENDPOINT = 'https://blue-api.morpho.org/graphql';

export const morphoApiClient = new MorphoGraphQLClient(MORPHO_GRAPHQL_ENDPOINT); 