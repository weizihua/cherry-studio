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
    <Container>
      <Header>
        <Title level={5}>{t('agents.add.knowledge_base.placeholder')}</Title>
        <SearchInput
          placeholder="Search knowledge bases..."
          prefix={<DatabaseOutlined style={{ color: 'var(--color-text-3)' }} />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          autoFocus
        />
      </Header>

      {knowledgeState.bases.length === 0 ? (
        <EmptyContainer>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No knowledge bases available" />
        </EmptyContainer>
      ) : (
        <ListContainer>
          <List
            itemLayout="horizontal"
            dataSource={filteredBases}
            renderItem={(base, index) => (
              <KnowledgeItem $selected={index === selectedIndex} onClick={() => selectKnowledgeBase(base)}>
                <KnowledgeAvatar>
                  <DatabaseOutlined />
                </KnowledgeAvatar>
                <KnowledgeInfo>
                  <KnowledgeName>{base.name}</KnowledgeName>
                  {/* <KnowledgeDescription>{base.description || `${base.items?.length || 0} items`}</KnowledgeDescription> */}
                </KnowledgeInfo>
              </KnowledgeItem>
            )}
            locale={{
              emptyText: searchText ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`No results for "${searchText}"`} />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No knowledge bases available" />
              )
            }}
          />
        </ListContainer>
      )}
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
