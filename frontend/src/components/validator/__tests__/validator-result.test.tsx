import { render, screen } from "@testing-library/react"
import useSWR from "swr"
import { LanguageProvider } from "../../../lib/i18n/language-context"
import { ValidatorResult } from "../validator-result"

// Mock useSWR
jest.mock("swr")
const mockUseSWR = useSWR as jest.Mock

describe("ValidatorResult", () => {
  const mockData = {
    domain: "example.com",
    ads_txt_url: "https://example.com/ads.txt",
    stats: {
      total: 2,
      valid: 1,
      invalid: 1,
      warnings: 1
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
        line_number: 2,
        domain: "badprovider.com",
        account_id: "123",
        account_type: "DIRECT",
        is_valid: false,
        raw_line: "badprovider.com, 123, DIRECT",
        error: "INVALID_DOMAIN",
        validation_key: "INVALID_DOMAIN"
      }
    ]
  }

  beforeEach(() => {
    mockUseSWR.mockReset()
  })

  it("renders loading state", () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      isLoading: true
    })

    render(
      <LanguageProvider>
        <ValidatorResult domain="example.com" type="ads.txt" />
      </LanguageProvider>
    )
    expect(screen.getByText("Fetching and analyzing...")).toBeInTheDocument()
  })

  it("renders stats correctly", () => {
    mockUseSWR.mockReturnValue({
      data: mockData,
      isLoading: false
    })

    render(
      <LanguageProvider>
        <ValidatorResult domain="example.com" type="ads.txt" />
      </LanguageProvider>
    )

    expect(screen.getByText("Valid Records")).toBeInTheDocument()

    // Check if "1" is present multiple times (valid=1, invalid=1, warning=1)
    const ones = screen.getAllByText("1")
    expect(ones.length).toBeGreaterThanOrEqual(2)

    // Check specific table content
    expect(screen.getByText("google.com")).toBeInTheDocument()
  })

  it("renders records with correct styles", () => {
    mockUseSWR.mockReturnValue({
      data: mockData,
      isLoading: false
    })

    render(
      <LanguageProvider>
        <ValidatorResult domain="example.com" type="ads.txt" />
      </LanguageProvider>
    )

    // Check valid record
    const validRow = screen.getByText("google.com").closest("tr")
    expect(validRow).not.toHaveClass("bg-red-50")

    // Check invalid record
    const invalidRow = screen.getByText("badprovider.com").closest("tr")
    expect(invalidRow).toHaveClass("bg-red-50")
    expect(screen.getByText("Invalid Domain (Code: 11030)")).toBeInTheDocument()
  })
})
