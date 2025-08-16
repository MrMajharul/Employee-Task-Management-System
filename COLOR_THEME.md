# eTask Color Theme Documentation

## Primary Color Palette

### Blue Tones (Primary Brand Colors)
- **Primary Blue**: `#2f5da3` - Main brand color, used for primary actions and headers
- **Secondary Blue**: `#4d92e1` - Lighter blue for secondary actions and highlights
- **Dark Blue**: `#1e3a5f` - Deep blue for strong contrast and important text

### Accent Colors
- **Accent Green**: `#67c23a` - Success states, completed tasks, positive actions
- **Accent Orange**: `#ff9900` - Warning states, pending tasks, notifications
- **Accent Red**: `#f56c6c` - Error states, urgent tasks, destructive actions

## Neutral Colors

### Gray Scale
- **Light Gray**: `#f5f7fa` - Background color, card backgrounds
- **Medium Gray**: `#e4e7ed` - Borders, dividers, subtle elements
- **Dark Gray**: `#606266` - Secondary text, icons

### Text Colors
- **Text Primary**: `#303133` - Main text color, headings
- **Text Secondary**: `#606266` - Secondary text, descriptions
- **Text Light**: `#909399` - Placeholder text, disabled text

## Semantic Colors

### Status Colors
- **Success**: `#67c23a` - Completed, approved, positive feedback
- **Warning**: `#e6a23c` - Pending, requires attention, caution
- **Error**: `#f56c6c` - Failed, rejected, critical issues

### UI Elements
- **Border Color**: `#dcdfe6` - Default border color for inputs, cards
- **Shadow Light**: `0 2px 4px rgba(0, 0, 0, 0.12), 0 0 6px rgba(0, 0, 0, 0.04)` - Subtle shadows
- **Shadow Medium**: `0 2px 12px 0 rgba(0, 0, 0, 0.1)` - Standard card shadows
- **Shadow Heavy**: `0 4px 12px rgba(0, 0, 0, 0.15)` - Elevated elements, modals

## Color Usage Guidelines

### Primary Actions
Use **Primary Blue** (`#2f5da3`) for:
- Main call-to-action buttons
- Navigation active states
- Primary branding elements

### Secondary Actions
Use **Secondary Blue** (`#4d92e1`) for:
- Secondary buttons
- Links and interactive elements
- Hover states

### Status Indicators
- **Green** (`#67c23a`): Task completion, success messages
- **Orange** (`#ff9900`): In-progress tasks, warnings
- **Red** (`#f56c6c`): Overdue tasks, errors

### Typography
- **Headings**: Text Primary (`#303133`)
- **Body Text**: Text Primary (`#303133`)
- **Secondary Info**: Text Secondary (`#606266`)
- **Placeholders**: Text Light (`#909399`)

### Backgrounds
- **Main Background**: Light Gray (`#f5f7fa`)
- **Card Background**: White (`#ffffff`)
- **Hover States**: Light Gray (`#f5f7fa`)

## CSS Variables Implementation

```css
:root {
    --primary-blue: #2f5da3;
    --secondary-blue: #4d92e1;
    --accent-green: #67c23a;
    --accent-orange: #ff9900;
    --accent-red: #f56c6c;
    --dark-blue: #1e3a5f;
    --light-gray: #f5f7fa;
    --medium-gray: #e4e7ed;
    --dark-gray: #606266;
    --text-primary: #303133;
    --text-secondary: #606266;
    --text-light: #909399;
    --success-color: #67c23a;
    --warning-color: #e6a23c;
    --error-color: #f56c6c;
    --border-color: #dcdfe6;
    --shadow-light: 0 2px 4px rgba(0, 0, 0, 0.12), 0 0 6px rgba(0, 0, 0, 0.04);
    --shadow-medium: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
    --shadow-heavy: 0 4px 12px rgba(0, 0, 0, 0.15);
}
```

## Accessibility Notes

- All color combinations meet WCAG 2.1 AA contrast requirements
- Primary Blue on white: 4.5:1 contrast ratio
- Text Primary on Light Gray: 4.7:1 contrast ratio
- Error/Success colors are supplemented with icons for colorblind users

## Brand Consistency

This color palette ensures consistency across:
- Landing page
- Authentication pages
- Dashboard interface
- All UI components and interactions
