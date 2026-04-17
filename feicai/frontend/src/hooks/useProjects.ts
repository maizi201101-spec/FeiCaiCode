import { useState, useEffect, useCallback } from 'react'
import {
  type Project,
  type Episode,
  type CreateProjectPayload,
  type CreateEpisodePayload,
  getProjects,
  createProject as apiCreateProject,
  getEpisodes,
  createEpisode as apiCreateEpisode,
  deleteEpisode as apiDeleteEpisode,
} from '../api/projects'

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getProjects()
      setProjects(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取项目列表失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const createProject = useCallback(async (payload: CreateProjectPayload) => {
    const project = await apiCreateProject(payload)
    setProjects((prev) => [project, ...prev])
    return project
  }, [])

  return { projects, loading, error, refetch: fetchProjects, createProject }
}

export function useEpisodes(projectId: number | null) {
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchEpisodes = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getEpisodes(projectId)
      setEpisodes(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取集数列表失败')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchEpisodes()
  }, [fetchEpisodes])

  const createEpisode = useCallback(
    async (payload: CreateEpisodePayload) => {
      if (!projectId) throw new Error('No project selected')
      const episode = await apiCreateEpisode(projectId, payload)
      setEpisodes((prev) => [...prev, episode])
      return episode
    },
    [projectId]
  )

  const deleteEpisode = useCallback(
    async (episodeId: number) => {
      if (!projectId) throw new Error('No project selected')
      await apiDeleteEpisode(projectId, episodeId)
      setEpisodes((prev) => prev.filter((e) => e.id !== episodeId))
    },
    [projectId]
  )

  return { episodes, loading, error, refetch: fetchEpisodes, createEpisode, deleteEpisode }
}
