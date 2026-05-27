import { useAuthStore } from '@/stores/auth'

const BASE_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000'

class ApiClient {
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    onProgress?: (pct: number) => void,
  ): Promise<T> {
    const { accessToken } = useAuthStore.getState()

    const headers: Record<string, string> = {}
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

    let fetchBody: BodyInit | undefined
    if (body instanceof FormData) {
      fetchBody = body
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      fetchBody = JSON.stringify(body)
    }

    const res = await fetch(`${BASE_URL}${path}`, { method, headers, body: fetchBody })

    if (res.status === 401) {
      // Try refresh
      const { refreshToken, setAuth, clearAuth } = useAuthStore.getState()
      if (refreshToken) {
        const refreshRes = await fetch(`${BASE_URL}/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
        if (refreshRes.ok) {
          const data = await refreshRes.json() as { data: { accessToken: string; refreshToken: string } }
          const user = useAuthStore.getState().user!
          setAuth(data.data.accessToken, data.data.refreshToken, user)
          // Retry
          return this.request<T>(method, path, body)
        }
      }
      clearAuth()
      window.location.href = '/auth/login'
      throw new Error('Unauthorized')
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string; code?: string }
      throw Object.assign(new Error(err.error ?? 'Request failed'), { code: err.code, statusCode: res.status })
    }

    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path)
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body)
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body)
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path)
  }

  upload<T>(path: string, formData: FormData, onProgress?: (pct: number) => void): Promise<T> {
    return this.request<T>('POST', path, formData, onProgress)
  }
}

export const api = new ApiClient()
