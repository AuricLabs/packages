# @auriclabs/metrics

## 0.0.1

### Patch Changes

- Initial release with metrics collection and visualization
- Added `recordMetrics` for manual metric recording
- Added `span` for automatic function tracking with dot notation building
  - **Synchronous and asynchronous function support**: Works with both sync and async functions
  - **Return value preservation**: Properly returns values from wrapped functions
  - **Improved type safety**: Function overloads for better TypeScript inference
  - **Nested span support**: Automatic hierarchical namespace building via nested spans
- Added `displayMetrics` with beautiful table visualization:
  - Summary table showing aggregate statistics
  - Hierarchical tree table with Unicode box-drawing characters (├──, └──, │)
  - All metrics displayed in tabular format with tree structure in first column
- Support for hierarchical metrics with automatic dot-separated namespace building
- Error tracking and display with visual highlighting
- Performance statistics (min, max, avg, total duration)
- Color-coded output for better readability using chalk
- Comprehensive test coverage for sync/async return values and error handling
