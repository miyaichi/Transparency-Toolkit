import { fireEvent, render, screen } from "@testing-library/react"
import useSWR from "swr"
import { LanguageProvider } from "../../../lib/i18n/language-context"
import { ExplorerResult } from "../explorer-result"

// Mock useSWR
jest.mock("swr")
const mockUseSWR = useSWR as jest.Mock

describe("ExplorerResult", () => {
  const mockData = {
    domain: "example.com",
    ads_txt_url: "https://example.com/ads.txt",
    stats: {
      total: 2,
      valid: 2,
      invalid: 0,
      warnings: 0
    },
    records: [
      {
        line_number: 1,
        domain: "google.com",
        account_id: "pub-0000",
        account_type: "DIRECT",
        relationship: "DIRECT",
        is_valid: true,
        raw_line: "google.com, pub-0000, DIRECT"
      },
      {
        line_number: -1,
        domain: "auto.com",
        account_id: "pub-9999",
        account_type: "RESELLER",
        relationship: "RESELLER",
        is_valid: true,
        raw_line: "OWNERDOMAIN=auto.com"
      }
    ]
  }

  beforeEach(() => {
    mockUseSWR.mockReset()
  })

  it("renders loading state", () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true
    })

    render(
      <LanguageProvider>
        <ExplorerResult domain="example.com" type="ads.txt" />
      </LanguageProvider>
    )
    expect(screen.getByText("Fetching ads.txt...")).toBeInTheDocument()
  })

  it("renders error state", () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: new Error("Failed to fetch"),
      isLoading: false
    })

    render(
      <LanguageProvider>
        <ExplorerResult domain="example.com" type="ads.txt" />
      </LanguageProvider>
    )
    expect(screen.getByText("Failed to load report")).toBeInTheDocument()
    expect(screen.getByText("Failed to fetch")).toBeInTheDocument()
  })

  it("renders records table", () => {
    mockUseSWR.mockReturnValue({
      data: mockData,
      error: undefined,
      isLoading: false
    })

    render(
      <LanguageProvider>
        <ExplorerResult domain="example.com" type="ads.txt" />
      </LanguageProvider>
    )

    // Check stats
    expect(screen.getByText("Total Records")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()

    // Check table headers
    expect(screen.getByText("Advertising System")).toBeInTheDocument()
    expect(screen.getByText("Publisher Account ID")).toBeInTheDocument()

    // Check records
    expect(screen.getByText("google.com")).toBeInTheDocument()
    expect(screen.getByText("pub-0000")).toBeInTheDocument()

    // Check Auto line number
    expect(screen.getByText("Auto")).toBeInTheDocument()
    expect(screen.getByText("auto.com")).toBeInTheDocument()
  })

  it("filters records", () => {
    mockUseSWR.mockReturnValue({
      data: mockData,
      error: undefined,
      isLoading: false
    })

    render(
      <LanguageProvider>
        <ExplorerResult domain="example.com" type="ads.txt" />
      </LanguageProvider>
    )

    const input = screen.getByPlaceholderText("Filter by domain, ID...")
    fireEvent.change(input, { target: { value: "google" } })

    expect(screen.getByText("google.com")).toBeInTheDocument()
    expect(screen.queryByText("auto.com")).not.toBeInTheDocument()
  })
})
