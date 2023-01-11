import useSWR from 'swr'

function useUser (): {
  user: Express.User | undefined
  isLoading: boolean
  isError: boolean
} {
  const fetcher = async (url: string): Promise<Express.User> => {
    return await fetch(url).then(async (r) => (await r.json()).data as Express.User)
  }

  const { data, error } = useSWR('/api/user', fetcher)

  return {
    user: data,
    isLoading: error == null && data == null,
    isError: error
  }
}

export default useUser
