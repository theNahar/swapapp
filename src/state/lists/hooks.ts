import DEFAULT_TOKEN_LIST from './deafultList.json'
import { TokenList } from '@uniswap/token-lists'
import { useMemo } from 'react'
import { useAppSelector } from 'state/hooks'
// import sortByListPriority from 'utils/listSort'
// import UNSUPPORTED_TOKEN_LIST from '../../constants/tokenLists/uniswap-v2-unsupported.tokenlist.json'
import { AppState } from '../index'
// import { UNSUPPORTED_LIST_URLS } from './../../constants/lists'
import { WrappedTokenInfo } from './wrappedTokenInfo'

export type TokenAddressMap = Readonly<{
  [chainId: number]: Readonly<{ [tokenAddress: string]: { token: WrappedTokenInfo; list: TokenList } }>
}>

const listCache: WeakMap<TokenList, TokenAddressMap> | null =
  typeof WeakMap !== 'undefined' ? new WeakMap<TokenList, TokenAddressMap>() : null

function listToTokenMap(list: TokenList): TokenAddressMap {
  const result = listCache?.get(list)
  if (result) return result

  const map = list.tokens.reduce<TokenAddressMap>((tokenMap, tokenInfo) => {
    const token = new WrappedTokenInfo(tokenInfo, list)
    if (tokenMap[token.chainId]?.[token.address.toString()] !== undefined) {
      console.error(new Error(`Duplicate token! ${token.address}`))
      return tokenMap
    }
    return {
      ...tokenMap,
      [token.chainId]: {
        ...tokenMap[token.chainId],
        [token.address.toString()]: {
          token,
          list,
        },
      },
    }
  }, {})
  listCache?.set(list, map)
  return map
}

const TRANSFORMED_DEFAULT_TOKEN_LIST = listToTokenMap(DEFAULT_TOKEN_LIST)

export function useAllLists(): AppState['lists']['byUrl'] {
  return useAppSelector((state) => state.lists.byUrl)
}

function combineMaps(map1: TokenAddressMap, map2: TokenAddressMap): TokenAddressMap {
  return {
    // 1,4,3,42,5 were the older values
    [101]: { ...map1[101], ...map2[101] },
    [102]: { ...map1[102], ...map2[102] },
    [103]: { ...map1[103], ...map2[103] },
    [104]: { ...map1[104], ...map2[104] },
  }
}

// merge tokens contained within lists from urls
function useCombinedTokenMapFromUrls(urls: string[] | undefined): TokenAddressMap {
  const lists = useAllLists()
  return useMemo(() => {
    if (!urls) return {}
    return (
      urls
        .slice()
        // sort by priority so top priority goes last
        // .sort(sortByListPriority)
        .reduce((allTokens, currentUrl) => {
          const current = lists[currentUrl]?.current
          if (!current) return allTokens
          try {
            return combineMaps(allTokens, listToTokenMap(current))
          } catch (error) {
            console.error('Could not show token list due to error', error)
            return allTokens
          }
        }, {})
    )
  }, [lists, urls])
}

// filter out unsupported lists
export function useActiveListUrls(): string[] | undefined {
  // return useAppSelector((state) => state.lists.activeListUrls)?.filter((url) => !UNSUPPORTED_LIST_URLS.includes(url))
  return useAppSelector((state) => state.lists.activeListUrls)
}

export function useInactiveListUrls(): string[] {
  const lists = useAllLists()
  const allActiveListUrls = useActiveListUrls()
  // return Object.keys(lists).filter((url) => !allActiveListUrls?.includes(url) && !UNSUPPORTED_LIST_URLS.includes(url))
  return Object.keys(lists).filter((url) => !allActiveListUrls?.includes(url))
}

// get all the tokens from active lists, combine with local default tokens
export function useCombinedActiveList(): TokenAddressMap {
  const activeListUrls = useActiveListUrls()
  const activeTokens = useCombinedTokenMapFromUrls(activeListUrls)
  return combineMaps(activeTokens, TRANSFORMED_DEFAULT_TOKEN_LIST)
}

// list of tokens not supported on interface, used to show warnings and prevent swaps and adds
export function useUnsupportedTokenList(): TokenAddressMap {
  // get hard coded unsupported tokens
  // const localUnsupportedListMap = listToTokenMap(UNSUPPORTED_TOKEN_LIST)
  const localUnsupportedListMap = useCombinedTokenMapFromUrls(undefined)

  // get any loaded unsupported tokens
  // const loadedUnsupportedListMap = useCombinedTokenMapFromUrls(UNSUPPORTED_LIST_URLS)
  const loadedUnsupportedListMap = useCombinedTokenMapFromUrls(undefined)

  // format into one token address map
  return useMemo(
    () => combineMaps(localUnsupportedListMap, loadedUnsupportedListMap),
    [localUnsupportedListMap, loadedUnsupportedListMap]
  )
}

export function useIsListActive(url: string): boolean {
  const activeListUrls = useActiveListUrls()
  return Boolean(activeListUrls?.includes(url))
}
