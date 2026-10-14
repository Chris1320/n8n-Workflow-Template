"""Type stubs for n8n Python Code node runtime environment.

These variables and methods are injected into the Python execution scope by n8n.
"""

class _InputItem:
    json: dict[str, object]
    binary: dict[str, object] | None

class _InputNode:
    def all(self, input_index: int = 0) -> list[_InputItem]: ...
    def first(self, input_index: int = 0) -> _InputItem: ...
    @property
    def item(self) -> _InputItem: ...

_input: _InputNode
_json: dict[str, object]
_prevNode: dict[str, object]
_node: dict[str, object]
