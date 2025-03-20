import { FileSearchOutlined } from '@ant-design/icons'
import { KnowledgeBase } from '@renderer/types'
import { Flex, Tag } from 'antd'
import { FC } from 'react'
import styled from 'styled-components'

const SelectedKnowledgeBaseInput: FC<{
  selectedKnowledgeBase: KnowledgeBase[]
  onRemoveKnowledgeBase: (knowledgeBase: KnowledgeBase) => void
}> = ({ selectedKnowledgeBase, onRemoveKnowledgeBase }) => {
  return (
    <Container gap="4px 0" wrap>
      {selectedKnowledgeBase.map((knowledgeBase) => (
        <StyledTag
          bordered={false}
          color="pink"
          key={knowledgeBase.id}
          closable
          onClose={() => onRemoveKnowledgeBase(knowledgeBase)}>
          <FileSearchOutlined />
          {knowledgeBase.name}
        </StyledTag>
      ))}
    </Container>
  )
}

const Container = styled(Flex)`
  width: 100%;
  padding: 10px 15px 0;
`

const StyledTag = styled(Tag)`
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

export default SelectedKnowledgeBaseInput
