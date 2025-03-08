import { useAppSelector } from '@renderer/store'
import { KnowledgeBase } from '@renderer/types'
import { Flex } from 'antd'
import { Tag } from 'antd/lib'
import { FC } from 'react'
import styled from 'styled-components'

const SelectKnowledgePopup: FC<{
  selectKnowledgeBase: (knowledgeBase: KnowledgeBase) => void
}> = ({ selectKnowledgeBase }) => {
  const knowledgeState = useAppSelector((state) => state.knowledge)

  // 当没有知识库时显示提示信息
  if (knowledgeState.bases.length === 0) {
    return (
      <Container gap="4px 0" wrap>
        <Tag bordered={false} color="default">
          No knowledge bases available
        </Tag>
      </Container>
    )
  }

  return (
    <Container gap="4px 0" wrap>
      {knowledgeState.bases.map((knowledgeBase) => (
        <KnowledgeTag
          bordered={false}
          color="pink"
          key={knowledgeBase.id}
          onClick={() => selectKnowledgeBase(knowledgeBase)}>
          #{knowledgeBase.name}
        </KnowledgeTag>
      ))}
    </Container>
  )
}

const Container = styled(Flex)`
  width: 100%;
  padding: 10px 15px;
`

const KnowledgeTag = styled(Tag)`
  cursor: pointer;
  margin: 4px;
  transition: all 0.2s;

  &:hover {
    transform: scale(1.05);
  }
`

export default SelectKnowledgePopup
