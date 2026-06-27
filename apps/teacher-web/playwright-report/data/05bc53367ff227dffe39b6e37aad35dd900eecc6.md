# Page snapshot

```yaml
- generic [ref=e2]:
    - link "Skip to main content" [ref=e3] [cursor=pointer]:
        - /url: "#main-content"
    - generic [ref=e4]:
        - generic [ref=e8]:
            - list [ref=e10]:
                - listitem [ref=e11]:
                    - link "T Teacher" [ref=e12] [cursor=pointer]:
                        - /url: /
                        - generic [ref=e14]: T
                        - generic [ref=e15]: Teacher
            - generic [ref=e16]:
                - generic [ref=e17]:
                    - generic [ref=e18]: Overview
                    - list [ref=e20]:
                        - listitem [ref=e21]:
                            - link "Dashboard" [ref=e22] [cursor=pointer]:
                                - /url: /
                                - img [ref=e23]
                                - generic [ref=e28]: Dashboard
                - generic [ref=e29]:
                    - generic [ref=e30]: Content
                    - list [ref=e32]:
                        - listitem [ref=e33]:
                            - link "Spaces" [ref=e34] [cursor=pointer]:
                                - /url: /spaces
                                - img [ref=e35]
                                - generic [ref=e37]: Spaces
                        - listitem [ref=e38]:
                            - link "Question Bank" [ref=e39] [cursor=pointer]:
                                - /url: /question-bank
                                - img [ref=e40]
                                - generic [ref=e42]: Question Bank
                        - listitem [ref=e43]:
                            - link "Exams" [ref=e44] [cursor=pointer]:
                                - /url: /exams
                                - img [ref=e45]
                                - generic [ref=e48]: Exams
                        - listitem [ref=e49]:
                            - link "Rubric Presets" [ref=e50] [cursor=pointer]:
                                - /url: /rubric-presets
                                - img [ref=e51]
                                - generic [ref=e57]: Rubric Presets
                        - listitem [ref=e58]:
                            - link "Assignments" [ref=e59] [cursor=pointer]:
                                - /url: /assignments
                                - img [ref=e60]
                                - generic [ref=e63]: Assignments
                        - listitem [ref=e64]:
                            - link "Batch Grading" [ref=e65] [cursor=pointer]:
                                - /url: /grading
                                - img [ref=e66]
                                - generic [ref=e69]: Batch Grading
                - generic [ref=e70]:
                    - generic [ref=e71]: Analytics
                    - list [ref=e73]:
                        - listitem [ref=e74]:
                            - link "Class Analytics" [ref=e75] [cursor=pointer]:
                                - /url: /analytics/classes
                                - img [ref=e76]
                                - generic [ref=e78]: Class Analytics
                        - listitem [ref=e79]:
                            - link "Exam Analytics" [ref=e80] [cursor=pointer]:
                                - /url: /analytics/exams
                                - img [ref=e81]
                                - generic [ref=e84]: Exam Analytics
                        - listitem [ref=e85]:
                            - link "Space Analytics" [ref=e86] [cursor=pointer]:
                                - /url: /analytics/spaces
                                - img [ref=e87]
                                - generic [ref=e89]: Space Analytics
                - generic [ref=e90]:
                    - generic [ref=e91]: People
                    - list [ref=e93]:
                        - listitem [ref=e94]:
                            - link "Classes" [ref=e95] [cursor=pointer]:
                                - /url: /classes
                                - img [ref=e96]
                                - generic [ref=e99]: Classes
                        - listitem [ref=e100]:
                            - link "Students" [ref=e101] [cursor=pointer]:
                                - /url: /students
                                - img [ref=e102]
                                - generic [ref=e107]: Students
                - generic [ref=e108]:
                    - generic [ref=e109]: System
                    - list [ref=e111]:
                        - listitem [ref=e112]:
                            - link "Settings" [ref=e113] [cursor=pointer]:
                                - /url: /settings
                                - img [ref=e114]
                                - generic [ref=e117]: Settings
            - generic [ref=e119]:
                - ? button "Greenwood International School" [ref=e120]
                    [cursor=pointer]
                  : - img
                    - generic [ref=e121]: Greenwood International School
                    - img
                - generic [ref=e122]:
                    - generic [ref=e123]: Priya Sharma
                    - button "Sign Out" [ref=e124] [cursor=pointer]
            - button "Toggle Sidebar" [ref=e125]
        - main [ref=e126]:
            - generic [ref=e127]:
                - button "Toggle Sidebar" [ref=e128] [cursor=pointer]:
                    - img
                    - generic [ref=e129]: Toggle Sidebar
                - generic [ref=e131]:
                    - button "Toggle theme" [ref=e132] [cursor=pointer]:
                        - img
                        - img
                    - button "Notifications" [ref=e133] [cursor=pointer]:
                        - img
                        - generic [ref=e134]: Notifications
            - main [ref=e136]:
                - status [ref=e137]
                - generic [ref=e140]:
                    - navigation "breadcrumb" [ref=e141]:
                        - list [ref=e142]:
                            - listitem [ref=e143]:
                                - link "Spaces" [ref=e144] [cursor=pointer]:
                                    - /url: /spaces
                            - listitem [ref=e145]:
                                - img [ref=e146]
                            - listitem [ref=e148]:
                                - link "Mathematics Fundamentals" [disabled]
                                  [ref=e149]
                    - generic [ref=e150]:
                        - button "Go back" [ref=e151] [cursor=pointer]:
                            - img
                        - generic [ref=e152]:
                            - heading "Mathematics Fundamentals" [level=1]
                              [ref=e153]
                            - generic [ref=e154]:
                                - generic [ref=e155]:
                                    - generic [ref=e156]: "Status:"
                                    - text: published
                                - generic [ref=e157]: learning
                        - generic [ref=e158]:
                            - button "Preview" [ref=e159] [cursor=pointer]:
                                - img
                                - text: Preview
                            - button "Unpublish" [ref=e160] [cursor=pointer]
                            - button "Archive" [ref=e161] [cursor=pointer]:
                                - img
                                - text: Archive
                    - generic [ref=e162]:
                        - tablist [ref=e163]:
                            - tab "Settings" [ref=e164] [cursor=pointer]:
                                - img [ref=e165]
                                - text: Settings
                            - ? tab "Content" [selected] [ref=e168]
                                [cursor=pointer]
                              : - img [ref=e169]
                                - text: Content
                            - tab "Rubric" [ref=e170] [cursor=pointer]:
                                - img [ref=e171]
                                - text: Rubric
                            - tab "Agent Config" [ref=e174] [cursor=pointer]:
                                - img [ref=e175]
                                - text: Agent Config
                            - tab "History" [ref=e178] [cursor=pointer]:
                                - img [ref=e179]
                                - text: History
                        - tabpanel "Content" [ref=e183]:
                            - generic [ref=e184]:
                                - generic [ref=e185]:
                                    - heading "Story Points (4)" [level=2]
                                      [ref=e186]
                                    - generic [ref=e187]:
                                        - ? combobox "Add story point of type"
                                            [ref=e188] [cursor=pointer]
                                          : - generic: + Add as type…
                                            - img [ref=e189]
                                        - ? button "Add" [ref=e191]
                                            [cursor=pointer]
                                          : - img
                                            - text: Add
                                - generic [ref=e192]:
                                    - generic [ref=e193]:
                                        - generic [ref=e195]:
                                            - ? button "Drag to reorder"
                                                [ref=e196]
                                              : - img [ref=e197]
                                            - ? button "Toggle details"
                                                [ref=e204] [cursor=pointer]
                                              : - img [ref=e205]
                                                - generic [ref=e207]:
                                                    Algebraic Expressions
                                                - generic [ref=e208]: standard
                                            - generic [ref=e209]:
                                                - generic [ref=e210]: 5 items
                                                - generic [ref=e211]: 24 Q
                                                - generic [ref=e212]: 7 M
                                            - ? button "Section" [ref=e213]
                                                [cursor=pointer]
                                              : - img
                                                - text: Section
                                            - ? button "Edit settings"
                                                [ref=e214] [cursor=pointer]
                                              : - img
                                            - ? button "Delete" [ref=e215]
                                                [cursor=pointer]
                                              : - img
                                        - generic [ref=e216]:
                                            - generic [ref=e217]:
                                                - generic [ref=e218]:
                                                    - generic [ref=e219]:
                                                        - generic [ref=e220]:
                                                            - heading
                                                              "Introduction"
                                                              [level=4]
                                                              [ref=e221]
                                                            - ? generic
                                                                [ref=e222]
                                                              : 1 item
                                                        - generic [ref=e223]:
                                                            - ? button
                                                                "Question"
                                                                [active]
                                                                [ref=e224]
                                                                [cursor=pointer]
                                                              : - img
                                                                - text: Question
                                                            - ? button
                                                                "Material"
                                                                [ref=e225]
                                                                [cursor=pointer]
                                                              : - img
                                                                - text: Material
                                                    - generic [ref=e228]:
                                                        - checkbox "Select What
                                                          are Algebraic
                                                          Expressions?"
                                                          [ref=e229]
                                                          [cursor=pointer]
                                                        - ? button "Drag to
                                                            reorder" [ref=e230]
                                                          : - img [ref=e231]
                                                        - ? button "Expand
                                                            preview" [ref=e238]
                                                            [cursor=pointer]
                                                          : - img [ref=e239]
                                                        - img [ref=e241]
                                                        - button "What are
                                                          Algebraic
                                                          Expressions?rich"
                                                          [ref=e244]
                                                          [cursor=pointer]
                                                        - ? button "Edit"
                                                            [ref=e245]
                                                            [cursor=pointer]
                                                          : - img
                                                        - ? button "Delete"
                                                            [ref=e246]
                                                            [cursor=pointer]
                                                          : - img
                                                - generic [ref=e247]:
                                                    - generic [ref=e248]:
                                                        - generic [ref=e249]:
                                                            - heading "Practice
                                                              Problems"
                                                              [level=4]
                                                              [ref=e250]
                                                            - ? generic
                                                                [ref=e251]
                                                              : 4 items
                                                        - generic [ref=e252]:
                                                            - ? button
                                                                "Question"
                                                                [ref=e253]
                                                                [cursor=pointer]
                                                              : - img
                                                                - text: Question
                                                            - ? button
                                                                "Material"
                                                                [ref=e254]
                                                                [cursor=pointer]
                                                              : - img
                                                                - text: Material
                                                    - generic [ref=e255]:
                                                        - generic [ref=e257]:
                                                            - 'checkbox "Select
                                                              Simplify: 3x + 5x"
                                                              [ref=e258]
                                                              [cursor=pointer]'
                                                            - ? button "Drag to
                                                                reorder"
                                                                [ref=e259]
                                                              : - img [ref=e260]
                                                            - ? button "Expand
                                                                preview"
                                                                [ref=e267]
                                                                [cursor=pointer]
                                                              : - img [ref=e268]
                                                            - img [ref=e270]
                                                            - 'button "Simplify:
                                                              3x + 5xmcq"
                                                              [ref=e273]
                                                              [cursor=pointer]'
                                                            - ? button "Edit"
                                                                [ref=e274]
                                                                [cursor=pointer]
                                                              : - img
                                                            - ? button "Delete"
                                                                [ref=e275]
                                                                [cursor=pointer]
                                                              : - img
                                                        - generic [ref=e277]:
                                                            - checkbox "Select
                                                              Evaluate 2a + 3b
                                                              when a=4, b=2"
                                                              [ref=e278]
                                                              [cursor=pointer]
                                                            - ? button "Drag to
                                                                reorder"
                                                                [ref=e279]
                                                              : - img [ref=e280]
                                                            - ? button "Expand
                                                                preview"
                                                                [ref=e287]
                                                                [cursor=pointer]
                                                              : - img [ref=e288]
                                                            - img [ref=e290]
                                                            - button "Evaluate
                                                              2a + 3b when a=4,
                                                              b=2numerical"
                                                              [ref=e293]
                                                              [cursor=pointer]
                                                            - ? button "Edit"
                                                                [ref=e294]
                                                                [cursor=pointer]
                                                              : - img
                                                            - ? button "Delete"
                                                                [ref=e295]
                                                                [cursor=pointer]
                                                              : - img
                                                        - generic [ref=e297]:
                                                            - checkbox "Select
                                                              Like terms
                                                              identification"
                                                              [ref=e298]
                                                              [cursor=pointer]
                                                            - ? button "Drag to
                                                                reorder"
                                                                [ref=e299]
                                                              : - img [ref=e300]
                                                            - ? button "Expand
                                                                preview"
                                                                [ref=e307]
                                                                [cursor=pointer]
                                                              : - img [ref=e308]
                                                            - img [ref=e310]
                                                            - button "Like terms
                                                              identificationmcaq"
                                                              [ref=e313]
                                                              [cursor=pointer]
                                                            - ? button "Edit"
                                                                [ref=e314]
                                                                [cursor=pointer]
                                                              : - img
                                                            - ? button "Delete"
                                                                [ref=e315]
                                                                [cursor=pointer]
                                                              : - img
                                                        - generic [ref=e317]:
                                                            - 'checkbox "Select
                                                              Factorize: x² + 5x
                                                              + 6" [ref=e318]
                                                              [cursor=pointer]'
                                                            - ? button "Drag to
                                                                reorder"
                                                                [ref=e319]
                                                              : - img [ref=e320]
                                                            - ? button "Expand
                                                                preview"
                                                                [ref=e327]
                                                                [cursor=pointer]
                                                              : - img [ref=e328]
                                                            - img [ref=e330]
                                                            - 'button
                                                              "Factorize: x² +
                                                              5x + 6mcq"
                                                              [ref=e333]
                                                              [cursor=pointer]'
                                                            - ? button "Edit"
                                                                [ref=e334]
                                                                [cursor=pointer]
                                                              : - img
                                                            - ? button "Delete"
                                                                [ref=e335]
                                                                [cursor=pointer]
                                                              : - img
                                            - status [ref=e336]
                                            - ? button "Import from Bank"
                                                [ref=e338] [cursor=pointer]
                                              : - img
                                                - text: Import from Bank
                                    - generic [ref=e341]:
                                        - button "Drag to reorder" [ref=e342]:
                                            - img [ref=e343]
                                        - ? button "Toggle details" [ref=e350]
                                            [cursor=pointer]
                                          : - img [ref=e351]
                                            - generic [ref=e353]:
                                                Linear Equations
                                            - generic [ref=e354]: standard
                                        - generic [ref=e355]:
                                            - generic [ref=e356]: 4 items
                                            - generic [ref=e357]: 1 Q
                                        - ? button "Section" [ref=e358]
                                            [cursor=pointer]
                                          : - img
                                            - text: Section
                                        - ? button "Edit settings" [ref=e359]
                                            [cursor=pointer]
                                          : - img
                                        - ? button "Delete" [ref=e360]
                                            [cursor=pointer]
                                          : - img
                                    - generic [ref=e363]:
                                        - button "Drag to reorder" [ref=e364]:
                                            - img [ref=e365]
                                        - ? button "Toggle details" [ref=e372]
                                            [cursor=pointer]
                                          : - img [ref=e373]
                                            - generic [ref=e375]:
                                                Geometry - Triangles
                                            - generic [ref=e376]: standard
                                        - generic [ref=e377]:
                                            - generic [ref=e378]: 3 items
                                            - generic [ref=e379]: 1 Q
                                        - ? button "Section" [ref=e380]
                                            [cursor=pointer]
                                          : - img
                                            - text: Section
                                        - ? button "Edit settings" [ref=e381]
                                            [cursor=pointer]
                                          : - img
                                        - ? button "Delete" [ref=e382]
                                            [cursor=pointer]
                                          : - img
                                    - generic [ref=e385]:
                                        - button "Drag to reorder" [ref=e386]:
                                            - img [ref=e387]
                                        - ? button "Toggle details" [ref=e394]
                                            [cursor=pointer]
                                          : - img [ref=e395]
                                            - generic [ref=e397]: Math Quiz 1
                                            - generic [ref=e398]: timed_test
                                        - generic [ref=e400]: 3 items
                                        - ? button "Preview as student"
                                            [ref=e401] [cursor=pointer]
                                          : - img
                                        - ? button "Section" [ref=e402]
                                            [cursor=pointer]
                                          : - img
                                            - text: Section
                                        - ? button "Edit settings" [ref=e403]
                                            [cursor=pointer]
                                          : - img
                                        - ? button "Delete" [ref=e404]
                                            [cursor=pointer]
                                          : - img
                                - status [ref=e405]
    - region "Notifications alt+T"
```
